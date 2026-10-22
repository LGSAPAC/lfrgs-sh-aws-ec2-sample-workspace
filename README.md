# Liferay Self-Hosted on Amazon EC2: sample workspace

A standard **Liferay Workspace for DXP 2026.Q1 LTS** (`dxp-2026.q1.13-lts`), with GitHub Actions that build it and deploy it to Liferay running on Amazon EC2, either as a **Docker container** or as a **Tomcat bundle**, on a **single instance** or a **high-availability** cluster.

The step-by-step guide that creates the AWS side (EC2, ALB, RDS, EFS, ECR, the GitHub OIDC role) lives in [LGSAPAC/lfrgs-sh-aws-ec2-tutorial](https://github.com/LGSAPAC/lfrgs-sh-aws-ec2-tutorial), section 12.

> **Status:** Draft, October 2026. The workspace build is tested locally and in GitHub Actions, together with the `linux/amd64` image build and the Tomcat artifact packaging (see [What was tested](#what-was-tested)). Pushing to ECR and deploying to EC2 are **not yet tested**.

## What's inside

| Path | What it is |
| --- | --- |
| `gradle.properties` | `liferay.workspace.product=dxp-2026.q1.13-lts`: pins the DXP version, the API BOM and the base Docker image |
| `settings.gradle` | Liferay Workspace Gradle plugin |
| `modules/ec2-sample-portlet` | Sample OSGi module (MVC portlet, Jakarta APIs). Shows a message and **the node that served the page**, so you can see the build arrived on every node |
| `client-extensions/ec2-sample-global-css` | Sample frontend client extension (global CSS) that adds an orange top border to pages it is assigned to |
| `configs/ec2/portal-workspace.properties` | Settings shared by every EC2 node (`web.server.display.node=true`). Included by the `portal-ext.properties` the tutorial renders on each instance |
| `configs/common`, `configs/local`, `configs/docker` | Standard workspace environments (`common` is merged into every environment) |
| `Dockerfile.ext` | Appended to the generated Dockerfile: selects the `ec2` configs instead of `local` (developer mode) |
| `.github/workflows/ci.yml` | GitHub Actions: build, image, push to ECR, deploy to EC2 ([CI/CD with GitHub Actions](#cicd-with-github-actions)) |
| `.github/scripts/ssm-run.sh` | Runs the deploy script on the stack's Liferay instances through AWS Systems Manager, one at a time |
| `.agents/`, `.claude/` | AI agent rules and skills that Blade 8 adds to every new workspace (Liferay's own; unchanged) |
| `GETTING_STARTED.md` | Liferay's standard workspace reference (all workspace properties and tasks) |

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| JDK | 21 | DXP 2026.Q1 is a Jakarta EE release; tested with Oracle JDK 21.0.12 |
| Gradle | not needed | Use the included wrapper (`./gradlew`, Gradle 8.9) |
| Docker with buildx | optional | Only to build the image locally; GitHub Actions builds it for you |
| Blade CLI | optional | Only to create new modules (`blade create -l` lists templates) |

## Build

```bash
./gradlew build
```

| Output | Path |
| --- | --- |
| OSGi module | `modules/ec2-sample-portlet/build/libs/com.liferay.ec2.sample.portlet-1.0.0.jar` |
| Client extension | `client-extensions/ec2-sample-global-css/dist/ec2-sample-global-css.zip` |

## What gets deployed

The same build feeds both Liferay runtimes on EC2:

```bash
./gradlew clean dockerDeploy createDockerfile
```

Workspace stages everything in `build/docker/` with a Dockerfile `FROM liferay/dxp:2026.q1.13-lts`.

> ⚠️ **Run `dockerDeploy` as well.** `createDockerfile` on its own stages only the configs: `build/docker/deploy` and `build/docker/client-extensions` stay empty.

| In `build/docker/` | Docker runtime: copied into the image at | Tomcat runtime: packaged as `liferay-artifacts-<tag>.tar.gz`, deployed to |
| --- | --- | --- |
| `deploy/com.liferay.ec2.sample.portlet-1.0.0.jar` | `/mnt/liferay/deploy` | `/opt/liferay/deploy` (hot deploy) |
| `client-extensions/ec2-sample-global-css.zip` | `/home/liferay/osgi/client-extensions` | `/opt/liferay/deploy` (hot deploy) |
| `configs/ec2` (merged with `configs/common`) | `/home/liferay/configs/ec2`, copied into `/opt/liferay` at startup | `/opt/liferay` (Liferay restarts only if a file changed) |

Environment-specific settings (database, search, clustering, virtual host, license) are **not** in the workspace: the tutorial renders them on each instance from Terraform settings and SSM Parameter Store. Keep `configs/ec2` for settings that belong on every node.

## CI/CD with GitHub Actions

[`.github/workflows/ci.yml`](.github/workflows/ci.yml):

| Job | Runs on | What it does |
| --- | --- | --- |
| `build` | Every push and pull request | JDK 21, `./gradlew build dockerDeploy createDockerfile`; fails if `build/docker` has no jars or zips, or `Dockerfile.ext` was not applied; uploads the Docker context and `liferay-artifacts-<tag>.tar.gz` |
| `image` | Pushes to `main`, `v*` tags, manual runs | Builds the `linux/amd64` image, checks it is amd64 and contains the jars, zips and `configs/ec2`, then pushes to ECR **only if** the AWS variables below exist |
| `deploy` | Pushes to `main`, `v*` tags and manual runs (untick **Deploy** to skip), **only if** `LIFERAY_STACK` is set | In the GitHub environment `ec2` (add required reviewers to approve each deploy): signs in to AWS with OIDC and runs `deploy-docker.sh <image>` or `deploy-tomcat.sh <s3-archive>` on every Liferay instance through SSM, **one instance at a time**, stopping at the first failure |

**Build tags:** a `v1.2.0` git tag gives `1.2.0`; anything else gives `<branch>-<short-sha>`, for example `main-1a2b3c4`.

### Connect it to your AWS stack

No AWS keys are stored in GitHub. After `terraform apply` in the tutorial, print the commands that set these repository **variables** (none is a secret):

```bash
terraform -chdir=terraform output -raw github_variables_commands
```

| Variable | Value (Terraform output) |
| --- | --- |
| `AWS_REGION` | Your region, for example `ap-southeast-1` |
| `AWS_ROLE_ARN` | `github_actions_role_arn` |
| `ECR_REPOSITORY` | `ecr_repository_url` |
| `ARTIFACT_BUCKET` | `artifact_bucket` |
| `LIFERAY_STACK` | `stack_name` |
| `LIFERAY_RUNTIME` | `docker` or `tomcat`, the same as `liferay_runtime` in Terraform |

Then create the environment **`ec2`** under **Settings → Environments**, with required reviewers and the `main` branch only.

Until the AWS variables are set, the workflow still builds and checks everything and says so in a notice; nothing is pushed or deployed.

### Notes

- **Trust policy:** the AWS role accepts this repository's `main` branch, `v*` tags and the `ec2` environment only. Using a fork or a renamed repository? Set `github_repository` in the tutorial's `terraform.tfvars` and apply again.
- **Rollback (Docker):** a node that does not become ready goes back to its previous image by itself, and the rollout stops. To return to an older build, re-run that run's `deploy` job.
- **Rollback (Tomcat):** re-run the older run's `deploy` job; its archive stays in S3 for 90 days.
- **Sessions:** Liferay does not replicate HTTP sessions. Users on the node being deployed are moved to another node and may need to sign in again.
- **Workflow changes need the `workflow` scope:** pushing changes to `.github/workflows/` with the GitHub CLI fails with "refusing to allow an OAuth App to create or update workflow" until you run `gh auth refresh -h github.com -s workflow`.

## Add your own code

- **OSGi modules:** `blade create -t <template> -p <package> <name>` inside the workspace, or copy existing modules into `modules/`. 2026.Q1 uses **Jakarta** APIs (`jakarta.portlet.*`, `jakarta.servlet.*`), not `javax.*`.
- **Frontend and configuration client extensions** (CSS, JavaScript, custom elements, themes, OAuth settings and so on): add a folder under `client-extensions/` with a `client-extension.yaml`. They build into `.zip` files and deploy like modules.
- **Microservice client extensions** (Spring Boot, Node.js): these run as **their own processes**, not inside DXP. On EC2 they need their own container (for example another service in the tutorial's Compose file, or ECS), a route through the ALB, and an OAuth2 connection to DXP. Not covered yet.
- **Version upgrades:** change `liferay.workspace.product` in `gradle.properties` and `liferay_version` in the tutorial's Terraform together, and follow Liferay's upgrade process.

## What was tested

| Step | Result (22 October 2026, macOS on Apple Silicon, JDK 21.0.12) |
| --- | --- |
| `./gradlew build` | ✅ Module jar and client extension zip built |
| `./gradlew clean dockerDeploy createDockerfile` | ✅ Both artifacts staged in `build/docker/`; Dockerfile includes `LIFERAY_WORKSPACE_ENVIRONMENT=ec2` |
| GitHub Actions `build` job | 🔎 Pending first run |
| GitHub Actions `image` job (`linux/amd64`, no AWS settings) | 🔎 Pending first run |
| Push to ECR (OIDC) | 🔎 Not yet tested (no AWS stack yet) |
| Deploy to EC2 through SSM (Docker and Tomcat runtimes) | 🔎 Not yet tested |
| Sample portlet visible and CSS client extension applied in DXP | 🔎 Not yet tested |

`dxp-2026.q1.13-lts` was the latest **promoted** 2026.Q1 release in Liferay's release feed (<https://releases.liferay.com/releases.json>) on 22 October 2026.
