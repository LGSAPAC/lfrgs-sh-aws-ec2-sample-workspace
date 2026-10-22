#!/usr/bin/env bash
#
# Runs a shell command on every Liferay instance of a stack through AWS Systems Manager,
# one instance at a time, and fails if any instance fails.
#
# Usage: ssm-run.sh <stack-name> <command>
#
# Instances are found by their tags (set by the tutorial's Terraform):
#   LiferayStack=<stack-name>  LiferayRole=liferay
#
# With max-concurrency 1 and max-errors 0, SSM stops the rollout at the first failure,
# so in the high-availability setup at least one node keeps serving the old build.

set -euo pipefail

STACK="${1:?Usage: ssm-run.sh <stack-name> <command>}"
COMMAND="${2:?Usage: ssm-run.sh <stack-name> <command>}"
TIMEOUT_SECONDS="${SSM_TIMEOUT_SECONDS:-3600}"

INSTANCES=$(aws ec2 describe-instances \
	--filters "Name=tag:LiferayStack,Values=${STACK}" "Name=tag:LiferayRole,Values=liferay" "Name=instance-state-name,Values=running" \
	--query 'Reservations[].Instances[].InstanceId' --output text)

if [ -z "${INSTANCES}" ]; then
	echo "::error::No running instances tagged LiferayStack=${STACK}, LiferayRole=liferay"
	exit 1
fi

echo "Instances: ${INSTANCES}"
echo "Command:   ${COMMAND}"

PARAMETERS=$(jq -n --arg cmd "${COMMAND}" --arg timeout "${TIMEOUT_SECONDS}" \
	'{commands: [$cmd], executionTimeout: [$timeout]}')

# shellcheck disable=SC2086 # INSTANCES is a space-separated list of IDs
COMMAND_ID=$(aws ssm send-command \
	--document-name AWS-RunShellScript \
	--comment "Liferay deploy from GitHub Actions run ${GITHUB_RUN_ID:-local}" \
	--instance-ids ${INSTANCES} \
	--max-concurrency 1 \
	--max-errors 0 \
	--timeout-seconds 600 \
	--parameters "${PARAMETERS}" \
	--query 'Command.CommandId' --output text)

echo "SSM command: ${COMMAND_ID}"

DEADLINE=$(( $(date +%s) + TIMEOUT_SECONDS + 300 ))

while true; do
	STATUS=$(aws ssm list-commands --command-id "${COMMAND_ID}" --query 'Commands[0].Status' --output text)

	case "${STATUS}" in
		Pending|InProgress|Delayed|Cancelling)
			if [ "$(date +%s)" -gt "${DEADLINE}" ]; then
				echo "::error::Timed out waiting for SSM command ${COMMAND_ID}"
				exit 1
			fi
			sleep 20
			;;
		*)
			break
			;;
	esac
done

for INSTANCE in ${INSTANCES}; do
	echo "::group::${INSTANCE}"
	aws ssm get-command-invocation --command-id "${COMMAND_ID}" --instance-id "${INSTANCE}" \
		--query '{Status: Status, Output: StandardOutputContent, Error: StandardErrorContent}' --output text || true
	echo "::endgroup::"
done

echo "Final status: ${STATUS}"

[ "${STATUS}" = "Success" ] || { echo "::error::SSM command ${COMMAND_ID} finished with status ${STATUS}"; exit 1; }
