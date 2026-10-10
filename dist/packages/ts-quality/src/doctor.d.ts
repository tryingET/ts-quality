export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun';
export declare function readPackageManager(rootDir: string): PackageManagerName;
/** Command that runs a package binary through the repository's package manager. */
export declare function packageManagerExec(packageManager: PackageManagerName, binary: string): string[];
export declare function renderDoctor(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
}): string;
export declare function machineValue(value: string): string;
export declare function renderDoctorMachine(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
}): string;
