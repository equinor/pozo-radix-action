var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as yaml from 'yaml';
import fs from 'fs';
import { promisify } from 'util';
import { state } from './state';
import path from 'path';
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
export function createEnvironment() {
    return __awaiter(this, void 0, void 0, function* () {
        const { name: env, copy, branch } = state.options;
        const kubeEnvironmentRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])$/;
        const envIsValid = kubeEnvironmentRegex.test(env);
        if (!copy && !envIsValid) {
            throw new Error(`Invalid environment name: ${env} (must match pattern ${kubeEnvironmentRegex.source})`);
        }
        const buf = yield readFile(state.environment.RADIX_FILE);
        const d = buf.toString();
        const obj = yaml.parse(d);
        if (obj.spec.environments.findIndex(e => e.name === env) >= 0) {
            console.log('Environment already exists');
            return;
        }
        if (!copy) {
            let envConfig = { name: env };
            if (branch) {
                envConfig = Object.assign(Object.assign({}, envConfig), { build: { from: branch } });
            }
            obj.spec.environments.push(envConfig);
            obj.spec.components = yield getComponentConfig(obj.spec.components, env, branch);
        }
        yield updateConfig(obj);
    });
}
function getComponentConfig(components, env, branch) {
    return __awaiter(this, void 0, void 0, function* () {
        let componentTemplate;
        try {
            const str = yield readFile(path.join(state.options.context, 'component-config.json')).then((b) => b.toString());
            componentTemplate = JSON.parse(str);
        }
        catch (_a) {
            componentTemplate = {};
        }
        for (let comp of components) {
            const template = componentTemplate[comp.name];
            const config = Object.assign({}, template);
            config.environment = env;
            if (!state.options.useRadixCI) {
                if (config.imageTagName) {
                    config.imageTagName = config.imageTagName.replace('{ENVIRONMENT}', env);
                } else if (!branch) {
                    config.imageTagName = env;
                }
            }

            const variables = yield getVariables(comp.name, env);
            if (variables) {
                config.variables = variables;
            }
            comp.environmentConfig.push(config);
        }
        return components;
    });
}
function updateConfig(obj) {
    return __awaiter(this, void 0, void 0, function* () {
        const doc = new yaml.Document();
        doc.setSchema();
        doc.contents = doc.schema.createNode(obj);
        const toYaml = String(doc);
        yield writeFile(state.environment.RADIX_FILE, toYaml, 'utf8');
    });
}
function getVariables(component, env) {
    return __awaiter(this, void 0, void 0, function* () {
        // Also use azure cli to update reply-url -> https://docs.microsoft.com/en-us/cli/azure/ad/app?view=azure-cli-latest#az_ad_app_update
        let file;
        try {
            file = (yield readFile(path.join(state.options.context, 'variables.json')));
        }
        catch (_a) {
            return null;
        }
        const json = JSON.parse(file.toString());
        const variables = json[component];
        if (!variables) {
            return null;
        }
        Object.keys(variables)
            .forEach(key => {
            variables[key] = variables[key].replace('{ENVIRONMENT}', env);
        });
        return variables;
    });
}
