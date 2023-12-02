import commander from 'commander';
import { clearOrphans } from './src/clean-radix-environments';
import { createEnvironment } from './src/create-environment';
import { teardownEnvironment } from './src/teardown';
import { setSecrets } from './src/update-secrets';
import { Options, state } from './src/state';
import path from 'path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { radix } from './src/util';
import { Response, ResponseInit } from 'node-fetch';


const program = commander.program;

program.version('0.0.1');

program
  .option('-d, --debug', 'Print debug info')
  .option('--create-environment', 'Create radix environment')
  .option('--branch <branchName>', 'Build from branch (optional)')
  .option('--update-secrets', 'Update RADIX secrets')
  .option('--teardown', 'Tear down environment')
  .option('--check-environment', 'Check if environment exists')
  .option('--clear-orphans', 'Delete orphaned environments')
  .option('-c, --copy', 'Copy template to radix-config', false)
  .option('-v, --vault <vaultName>', 'Vault to load secrets from', 'gom-kv-dev')
  .option('-n, --name <envName>', 'Name of environment', ``)
  .option('-a, --app <appName>', 'Name of application')
  .option('-c, --context <context>', 'Helper-file location', '.');

program.parse(process.argv);


(async () => {
  setState(program.opts() as Options);
  const options = state.options;
  if (options.createEnvironment) {
    await createEnvironment();
  } else if (options.updateSecrets) {
    await setSecrets();
  } else if (options.teardown) {
    await teardownEnvironment();
  } else if (options.clearOrphans) {
    await clearOrphans()
  } else if (options.checkEnvironment) {
    try {
      const res = await radix.environment().getEnvironment(options.app, options.name);
      if (res.status !== 'Orphan') {
        core.setOutput('exists', true);
      } else {
        core.setOutput('exists', false);
      }
    } catch (err) {
      console.log(err);
      const ex: Response = err;
      if (ex.status === 404) {
        core.setOutput('exists', false);
      } else {
        core.setFailed(`Invalid response from Radix, expected 20x or 404, got ${ex.status}`);
      }
    }
  }
})();

function parseGithub(): Options {
  const opts = {} as Options;
  try {
    opts.vault = core.getInput('vault');
    opts.debug = !!core.getInput('debug');
    opts.name = core.getInput('name')?.toLowerCase();
    opts.app = core.getInput('app');
    opts.registry = core.getInput('registry');
    opts.context = core.getInput('context');
    opts.branch = core.getInput('branch');
    opts.useRadixCI = core.getInput('useRadixCI');
    switch ( core.getInput('action') ) {
      case 'create':
        opts.createEnvironment = true;
        break;
      case 'teardown':
        opts.teardown = true;
        break;
      case 'update-secrets':
        opts.updateSecrets = true;
        break;
      case 'clear-orphans':
        opts.clearOrphans = true;
        break;
      case 'check-environment':
        opts.checkEnvironment = true;
        break;
      default:
        core.setFailed('No valid action supplied, must be create | teardown | update-secrets | clear-orphans | check-environment')
        process.exit();
    }
  } catch (error) {
    core.setFailed(error.message);
    process.exit(1);
  }
  return opts;
}

function setState(opts: Options) {
  if (typeof github.context.eventName !== 'undefined') {
    state.options = parseGithub();
  } else {
    state.options = opts;
  }
  const workSpace = process.env.GITHUB_WORKSPACE || process.cwd();
  const RADIX_FILE = path.join(workSpace, 'radixconfig.yaml');
  state.environment = {...state.environment, ...process.env, RADIX_FILE};
  Object.freeze(state);
  if (state.options.debug) {
    console.log(JSON.stringify(state, null, 2));
  }
}
