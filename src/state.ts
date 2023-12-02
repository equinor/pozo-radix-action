import path from "path";

export const state = {
    options: {
        createEnvironment: false,
        updateSecrets: false,
        teardown: false,
        clearOrphans: false,
        debug: false,
        checkEnvironment: false,
        copy: false,
        vault: '',
        name: '',
        app: '',
        registry: '',
        context: '',
        branch: null,
        useRadixCI: false
    },
    environment: {
        RADIX_API: `https://api.radix.equinor.com/api/v1`,
        RADIX_FILE: path.join(process.cwd(), 'radixconfig.yaml'),
        RADIX_TOKEN: ''
    } as {[key: string]: any}
};

export type Options = typeof state.options;
export type OptionNames = keyof Options;
