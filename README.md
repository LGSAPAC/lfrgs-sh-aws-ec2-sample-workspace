# Liferay Self-Hosted on Amazon EC2: sample workspace

A standard **Liferay Workspace for DXP 2026.Q1 LTS** (`dxp-2026.q1.13-lts`) with three samples, an OSGi module, a CSS client extension and a **React** client extension, and GitHub Actions that build it and deploy it to Liferay running on Amazon EC2, either as a **Docker container** or as a **Tomcat bundle**, on a **single instance** or a **high-availability** cluster.

The step-by-step guide that creates the AWS side (EC2, ALB, RDS, EFS, ECR, the GitHub OIDC role) lives in [LGSAPAC/lfrgs-sh-aws-ec2-tutorial](https://github.com/LGSAPAC/lfrgs-sh-aws-ec2-tutorial), section 12.

> **Status:** Draft, October 2026. Tested on 22 October 2026: the workspace build (locally and in GitHub Actions), the `linux/amd64` image, the push to Amazon ECR through GitHub OIDC, and the deploy to a single EC2 instance (Docker runtime) through SSM, with the portlet and both client extensions deployed. The Tomcat runtime's deploy and the high-availability rollout are not yet tested (see [What was tested](#what-was-tested)).

## What's inside

| Path | What it is |
| --- | --- |
| `gradle.properties` | `liferay.workspace.product=dxp-2026.q1.13-lts`: pins the DXP version, the API BOM and the base Docker image. Also selects Node.js 22 and npm for the React build ([React client extension](#react-client-extension)) |
| `settings.gradle` | Liferay Workspace Gradle plugin |
| `modules/ec2-sample-portlet` | Sample OSGi module (MVC portlet, Jakarta APIs). Shows a message and **the node that served the page**, so you can see the build arrived on every node |
| `client-extensions/ec2-sample-global-css` | Sample frontend client extension (global CSS) that adds an orange top border to pages it is assigned to |
| `client-extensions/ec2-sample-react-app` | Sample **React** app as a custom element client extension, built with Vite. A widget that greets the signed-in user by calling Liferay's headless API (`/o/headless-admin-user/v1.0/my-user-account`) through `Liferay.Util.fetch` ([React client extension](#react-client-extension)) |
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
| Node.js | not needed | The workspace downloads Node.js 22 into `build/node` for the React build |
| Blade CLI | optional | Only to create new modules (`blade create -l` lists templates) |

## Build

```bash
./gradlew build
```

| Output | Path |
| --- | --- |
| OSGi module | `modules/ec2-sample-portlet/build/libs/com.liferay.ec2.sample.portlet-1.0.0.jar` |
| CSS client extension | `client-extensions/ec2-sample-global-css/dist/ec2-sample-global-css.zip` |
| React client extension | `client-extensions/ec2-sample-react-app/dist/ec2-sample-react-app.zip` (Vite output in `static/`: `main.js`, `assets/index.css`) |

The first build downloads Gradle, the DXP 2026.Q1 dependencies, Node.js and the React app's npm packages (about 1 minute); later builds are faster.

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
| `client-extensions/ec2-sample-react-app.zip` | `/home/liferay/osgi/client-extensions` | `/opt/liferay/deploy` (hot deploy) |
| `configs/ec2` (merged with `configs/common`) | `/home/liferay/configs/ec2`, copied into `/opt/liferay` at startup | `/opt/liferay` (Liferay restarts only if a file changed) |

Environment-specific settings (database, search, clustering, virtual host, license) are **not** in the workspace: the tutorial renders them on each instance from Terraform settings and SSM Parameter Store. Keep `configs/ec2` for settings that belong on every node.

## React client extension

`client-extensions/ec2-sample-react-app` follows Liferay's own React + Vite sample ([`liferay-sample-custom-element-6`](https://github.com/liferay/liferay-portal/tree/master/workspaces/liferay-sample-workspace/client-extensions/liferay-sample-custom-element-6)) with the same pinned versions: React 18.2, Vite 8.3.4, TypeScript 5.7.2.

| File | Role |
| --- | --- |
| `client-extension.yaml` | `type: customElement`, `htmlElementName: ec2-sample-react-app`, `urls: main.js`, `cssURLs: "**/index*.css"`, `useESM: true`. The `assemble` block copies Vite's `build/vite` into the zip's `static/`: without it every asset returns 404 |
| `vite.config.ts` | Fixed entry name `main.js`, and `renderBuiltUrl` pointing built URLs at `/o/ec2-sample-react-app/`, where Liferay serves the extension |
| `src/main.tsx` | Defines the `<ec2-sample-react-app>` custom element; mounts React in `connectedCallback` and unmounts in `disconnectedCallback` |
| `src/App.tsx` | Greets the signed-in user from `/o/headless-admin-user/v1.0/my-user-account`, through `Liferay.Util.fetch` (which sends the session and CSRF token; plain `fetch()` would call the API anonymously) |
| `src/liferay.d.ts` | Types for the parts of the global `Liferay` object the app uses |
| `package-lock.json` | Locks the npm dependencies so CI builds the same app |

The workspace builds it as part of `./gradlew build`: it downloads Node.js, runs `npm install` and `npm run build` (`tsc -b && vite build`), then zips the output.

**Two workspace settings it needs** (in `gradle.properties`, both found while building this sample on 22 October 2026):

```properties
liferay.workspace.node.lts.codename=Jod
liferay.workspace.node.package.manager=npm
```

- **Node.js 22.** Vite 8 needs Node `^20.19.0 || >=22.12.0`; the workspace's default download is Node 20.12.2, which fails with `TypeError [ERR_INVALID_ARG_VALUE]: The argument 'format' must be one of: ...`. `Jod` is the Node 22 LTS codename and **is case-sensitive**: `jod` is silently ignored.
- **npm instead of yarn.** With the default yarn setup, a second root task (`:downloadNode`) downloads Node 20.12.2 over the Node 22 from the codename, and the build fails the same way. With npm, each client extension builds with Node 22.

To work on the app with hot reload, run `npm install && npm run dev` in its folder and open <http://localhost:5173>. The `Liferay` global doesn't exist outside DXP there, so the account line fails; the rest of the UI works.

## CI/CD with GitHub Actions

[`.github/workflows/ci.yml`](.github/workflows/ci.yml):

| Job | Runs on | What it does |
| --- | --- | --- |
| `build` | Every push and pull request | JDK 21, `./gradlew build dockerDeploy createDockerfile` (including the React build); fails if `build/docker` has no jars, if any client extension project is missing its zip, or if `Dockerfile.ext` was not applied; uploads the Docker context and `liferay-artifacts-<tag>.tar.gz` |
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

Then create the environment **`ec2`** under **Settings → Environments**, limited to the `main` branch and `v*` tags (the tutorial, section 12.2, has the CLI commands). **Required reviewers** (an approval before each deployment) need GitHub Team or Enterprise for a private repository; on GitHub Free GitHub refuses them, and every push to `main` deploys straight away. Commits whose message contains `[skip ci]` don't run the workflow, which is handy for documentation-only changes.

Until the AWS variables are set, the workflow still builds and checks everything and says so in a notice; nothing is pushed or deployed.

### Notes

- **Immutable OIDC subject:** if `gh api repos/<org>/<repo>/actions/oidc/customization/sub` shows `"use_immutable_subject":true`, the token's subject is `repo:<org>@<id>/<repo>@<id>:...`. Set that prefix as `github_oidc_subject_prefix` in the tutorial's Terraform, or the `image` job fails with `Not authorized to perform sts:AssumeRoleWithWebIdentity`. This repository uses it.
- **Trust policy:** the AWS role accepts this repository's `main` branch, `v*` tags and the `ec2` environment only. Using a fork or a renamed repository? Set `github_repository` in the tutorial's `terraform.tfvars` and apply again.
- **Rollback (Docker):** a node that does not become ready goes back to its previous image by itself, and the rollout stops. To return to an older build, re-run that run's `deploy` job.
- **Rollback (Tomcat):** re-run the older run's `deploy` job; its archive stays in S3 for 90 days.
- **Sessions:** Liferay does not replicate HTTP sessions. Users on the node being deployed are moved to another node and may need to sign in again.
- **Workflow changes need the `workflow` scope:** pushing changes to `.github/workflows/` with the GitHub CLI fails with "refusing to allow an OAuth App to create or update workflow" until you run `gh auth refresh -h github.com -s workflow`.

## Add your own code

- **OSGi modules:** `blade create -t <template> -p <package> <name>` inside the workspace, or copy existing modules into `modules/`. 2026.Q1 uses **Jakarta** APIs (`jakarta.portlet.*`, `jakarta.servlet.*`), not `javax.*`.
- **Frontend and configuration client extensions** (CSS, JavaScript, custom elements, themes, OAuth settings and so on): add a folder under `client-extensions/` with a `client-extension.yaml`. They build into `.zip` files and deploy like modules. For another React app, copy `ec2-sample-react-app` and change the name everywhere it appears (folder, `client-extension.yaml` key, `htmlElementName`, `friendlyURLMapping`, the `renderBuiltUrl` path and `customElements.define`); two apps can't share an element name.
- **Microservice client extensions** (Spring Boot, Node.js): these run as **their own processes**, not inside DXP. On EC2 they need their own container (for example another service in the tutorial's Compose file, or ECS), a route through the ALB, and an OAuth2 connection to DXP. Not covered yet.
- **Version upgrades:** change `liferay.workspace.product` in `gradle.properties` and `liferay_version` in the tutorial's Terraform together, and follow Liferay's upgrade process.

## What was tested

| Step | Result (22 October 2026, macOS on Apple Silicon, JDK 21.0.12) |
| --- | --- |
| `./gradlew build` | ✅ Module jar and client extension zip built |
| `./gradlew clean dockerDeploy createDockerfile` | ✅ Both artifacts staged in `build/docker/`; Dockerfile includes `LIFERAY_WORKSPACE_ENVIRONMENT=ec2` |
| React client extension build (`./gradlew clean build dockerDeploy createDockerfile`) | ✅ Node 22.23.3, Vite 8.3.4: `main.js` 142 kB (46 kB gzipped) and `assets/index.css`; zip staged in `build/docker/client-extensions` with `baseURL` `/o/ec2-sample-react-app` and `cssURLs=assets/index.css` |
| GitHub Actions with the React client extension | ✅ `build` passed in 53 s and `image` in 1 min 50 s ([run 39723266764](https://github.com/LGSAPAC/lfrgs-sh-aws-ec2-sample-workspace/actions/runs/39723266764)): Node 22.23.4 (the codename picks the latest Node 22 release, so CI may be a patch ahead of your machine), both client extension zips checked, `ec2-sample-react-app.zip` in the Tomcat archive and in the amd64 image at `/home/liferay/osgi/client-extensions` |
| GitHub Actions `build` job | ✅ Passed in 1 min 20 s ([run 39708712711](https://github.com/LGSAPAC/lfrgs-sh-aws-ec2-sample-workspace/actions/runs/39708712711)): jar, zip and `Dockerfile.ext` checks; `liferay-artifacts-main-232a113.tar.gz` with `deploy/` (jar, zip) and `configs/` (`portal-workspace.properties`, `portal-setup-wizard.properties`) |
| GitHub Actions `image` job (`linux/amd64`, no AWS settings) | ✅ Passed in 2 min 33 s: `dxp-custom:main-232a113`, amd64, about 3.1 GB, jar in `/mnt/liferay/deploy`, zip in `/home/liferay/osgi/client-extensions`, `/home/liferay/configs/ec2` present; not pushed, as expected |
| GitHub Actions `deploy` job | ✅ Skipped, as expected without `LIFERAY_STACK` |
| Push to ECR (OIDC) | ✅ `dxp-custom:main-9b4d5a8`, 2.0 GB compressed ([run 39725947441](https://github.com/LGSAPAC/lfrgs-sh-aws-ec2-sample-workspace/actions/runs/39725947441), second attempt, after setting the immutable OIDC subject prefix) |
| Deploy to EC2 through SSM, Docker runtime, single instance | ✅ Same run: `Deployed ...dxp-custom:main-9b4d5a8`, `Final status: Success`, deploy job 2 minutes. Both client extensions `STARTED`; the portlet deployed once the tutorial mounted its files at `/mnt/liferay/files` (tutorial section 7) |
| Deploy through SSM, Tomcat runtime, and HA rollout | 🔎 Not yet tested |
| Sample portlet visible, CSS client extension applied, React widget renders in DXP | 🔎 Not yet tested |

`dxp-2026.q1.13-lts` was the latest **promoted** 2026.Q1 release in Liferay's release feed (<https://releases.liferay.com/releases.json>) on 22 October 2026.
