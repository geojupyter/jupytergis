# Security & NPM dependencies

In late 2025, there were at least 4 major supply-chain attacks against NPM packages.
You can find details on those attacks in the Zulip topics linked below.

These attacks have been growing in sophistication and impact.
Mechanisms of attack are diverse, including
[extremely well-crafted phishing attacks against authors and maintainers](https://krebsonsecurity.com/2025/09/18-popular-code-packages-hacked-rigged-to-steal-crypto/)
and
[self-replication](https://krebsonsecurity.com/2025/09/self-replicating-worm-hits-180-software-packages/).

For example, an attacker may initially infect a package through phishing.
Then, an infected package may take advantage of
[post-install lifecycle scripts](https://docs.npmjs.com/cli/v8/using-npm/scripts#life-cycle-scripts)
to execute malicious code on the machine of a user who installs a package.

:::{warning}
🚨 **This behavior of running post-install scripts is enabled by default in the NPM
CLI**, which is extremely unsafe.
See "prevention below for details.
:::

The malicious code can search for credentials, including digital wallets, personal
logins (like your email), and credentials for publishing packages to NPM.
Those credentials are exfiltrated to the attacker.
NPM credentials can be used to infect additional packages, enabling an infection to
self-replicate and impact more users.

## Prevention

There are two main weaknesses in (some) package management tools that facilitate infection:

### Running lifecycle scripts by default

The NPM CLI and Yarn will both run post-install scripts by default.
Most users expect that installation doesn't include running untrusted code, so this is
extremely unsafe and can result in end-users being infected without knowing it.

#### NPM CLI prevention

```bash
npm config set ignore-scripts true
```

#### Yarn prevention

```bash
yarn config set ignore-scripts true --global
```

#### pnpm prevention

pnpm is safer by default!
Lifecycle scripts are disabled by default in pnpm.

### Installation of freshly-released packages

The window for infection by attacks like this is relatively short.
After an infected package is released, it's usually a matter of hours before the
community discovers the issue and the infected packages are pulled from NPM.

**A "cooldown" period of 7 days (10080 seconds) post-release would have been enough to
protect users from many known supply-chain attacks.**

Read more:

- [We should all be using dependency cooldowns](https://blog.yossarian.net/2025/11/21/We-should-all-be-using-dependency-cooldowns)
- [Dependency cooldowns, redux](https://blog.yossarian.net/2025/12/13/cooldowns-redux)

#### NPM CLI prevention

No known method.

#### Yarn prevention

[Yarn 4.10 introduced a feature that can prevent installation of freshly-released packages](https://medium.com/@roman_fedyskyi/yarn-4-10-adds-a-release-age-gate-for-safer-dependency-management-765c2d18149a).

#### pnpm prevention

[pnpm 10.16.0 introduced a feature that can prevent installation of freshly-released packages](https://pnpm.io/settings#minimumreleaseage)

### JupyterGIS' chosen package manager is `pnpm`

The traditional package manager for JupyterLab extension development is `jlpm`, which is
an old version of Y (3.x) that's vendored with JupyterLab.
Using such an old version of Yarn presents several security risks as described above.

Instead, JupyterGIS uses [`pnpm`](https://pnpm.io) as its JavaScript package manager.
`pnpm` does **not** run the lifecycle scripts of third-party dependencies by default.
It also lets us add a dependency age "cooldown" (see the `minimumReleaseAge` section
above; configured in `pnpm-workspace.yaml`).

## Zulip discussions

- [Nx has been compromised](https://jupyter.zulipchat.com/#narrow/channel/471314-geojupyter/topic/Nx.20has.20been.20compromised/with/536440000)
- [Several more npm packages compromised](https://jupyter.zulipchat.com/#narrow/channel/471314-geojupyter/topic/Several.20more.20npm.20packages.20compromised/with/538474626)
- [A 3rd NPM attack in 3 weeks](https://jupyter.zulipchat.com/#narrow/channel/471314-geojupyter/topic/A.203rd.20NPM.20attack.20in.203.20weeks/with/542327672)
- [NPM attack #4 (Shai Hulud returns)](https://jupyter.zulipchat.com/#narrow/channel/471314-geojupyter/topic/NPM.20attack.20.234.20.28Shai.20Hulud.20returns.29/with/559102856)
