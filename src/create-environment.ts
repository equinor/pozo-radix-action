import * as yaml from 'yaml';
import { RadixConfig, Component, Variables, EnvironmentConfig } from './radix-config';
import fs from 'fs';
import { promisify } from 'util';
import { state } from './state';
import path from 'path';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export async function createEnvironment() {
    const {name: env, copy, branch} = state.options;
    const kubeEnvironmentRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])$/;
    const envIsValid = kubeEnvironmentRegex.test(env);
    if (!copy && !envIsValid) {
        throw new Error(`Invalid environment name: ${env} (must match pattern ${kubeEnvironmentRegex.source})`);
    }
    const buf = await readFile(state.environment.RADIX_FILE);
    const d = buf.toString();
    const obj = yaml.parse(d) as RadixConfig;
    if (obj.spec.environments.findIndex( e => e.name === env) >= 0) {
        console.log('Environment already exists');
        return;
    }
    if (!copy) {
        let envConfig: {name: string; build?: {from: string}} = {name: env};
        if (branch) {
            envConfig = {...envConfig, build: { from: branch } };
        }
        obj.spec.environments.push(envConfig);
        obj.spec.components = await getComponentConfig(obj.spec.components, env, branch);
    }

    await updateConfig(obj);
}

async function getComponentConfig(components: Component[], env: string, branch?: string) {
    let componentTemplate: {[compName: string]: EnvironmentConfig};
    try {
        const str = await readFile(path.join(state.options.context, 'component-config.json')).then((b) => b.toString());
        componentTemplate = JSON.parse(str);
    } catch {
        componentTemplate = {};
    }
    for (let comp of components) {
        const template = componentTemplate[comp.name];
        const config = { ...template };
        config.environment = env;

        if (!state.options.useRadixCI) {
            if (config.imageTagName) {
                config.imageTagName = config.imageTagName.replace('{ENVIRONMENT}', env);
            } else if (!branch) {
                config.imageTagName = env;
            }
        }

        const variables = await getVariables(comp.name, env);
        if (variables) {
            config.variables = variables;
        }
        comp.environmentConfig.push(config);
    }
    return components;
}

async function updateConfig(obj: RadixConfig) {
    const doc = new yaml.Document()
    doc.setSchema()
    doc.contents = doc.schema.createNode(obj)
    const toYaml = String(doc);
    await writeFile(state.environment.RADIX_FILE , toYaml, 'utf8');
}


async function getVariables(component: string, env: string): Promise<Variables> {
    // Also use azure cli to update reply-url -> https://docs.microsoft.com/en-us/cli/azure/ad/app?view=azure-cli-latest#az_ad_app_update
    let file: Buffer;
    try {
        file = await readFile(path.join(state.options.context, 'variables.json')) as Buffer;
    } catch {
        return null;
    }
    const json = JSON.parse(file.toString());
    const variables: Variables = json[component];
    if (!variables) {
        return null;
    }
    Object.keys(variables)
        .forEach(key => {
            variables[key] = variables[key].replace('{ENVIRONMENT}', env);
        })
    return variables;
}
