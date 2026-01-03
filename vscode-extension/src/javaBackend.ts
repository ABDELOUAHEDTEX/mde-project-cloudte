import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Result of Java backend execution
 */
export interface JavaBackendResult {
    success: boolean;
    terraformFile?: string;
    modelFile?: string;
    output?: string;
    error?: string;
    provider?: string;
    resourceCount?: number;
    warnings?: string[];
}

/**
 * Options for executing Java backend
 */
export interface JavaBackendOptions {
    inputJson: any;
    outputDir: string;
    generateModel?: boolean;
    modelFileName?: string;
    terraformFileName?: string;
}

/**
 * Java Backend Integration Manager
 */
export class JavaBackend {
    private outputChannel: vscode.OutputChannel;
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('CloudInfraGen');
        this.config = vscode.workspace.getConfiguration('cloudinfragen');
    }

    /**
     * Execute Maven command to run Java backend
     */
    async executeMavenCommand(
        projectPath: string,
        mainClass: string,
        args: string[],
        options?: ExecOptions
    ): Promise<{ stdout: string; stderr: string }> {
        const mavenPath = this.config.get<string>('mavenPath', 'mvn');
        const javaPath = this.config.get<string>('javaPath', 'java');

        // Build Maven exec command
        const execArgs = args.map(arg => `"${arg}"`).join(' ');
        const mavenCommand = `${mavenPath} exec:java -Dexec.mainClass="${mainClass}" -Dexec.args="${execArgs}"`;

        // Log command
        this.outputChannel.appendLine(`[Maven] Executing: ${mavenCommand}`);
        this.outputChannel.appendLine(`[Maven] Working directory: ${projectPath}`);
        this.outputChannel.appendLine('');

        const execOptions: ExecOptions = {
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            env: {
                ...process.env,
                JAVA_HOME: process.env.JAVA_HOME || '',
                PATH: process.env.PATH || ''
            },
            ...options
        };

        try {
            const { stdout, stderr } = await execAsync(mavenCommand, execOptions);
            return { stdout, stderr };
        } catch (error: any) {
            // Maven may write to stderr even on success, so check exit code
            // Also, Maven exec:java may return non-zero on some warnings but still succeed
            if (error.code === 0) {
                return { stdout: error.stdout || '', stderr: error.stderr || '' };
            }
            
            // Check if output contains success indicators despite error code
            const combinedOutput = (error.stdout || '') + '\n' + (error.stderr || '');
            if (combinedOutput.includes('✓') || 
                combinedOutput.includes('success') || 
                combinedOutput.includes('succès') ||
                combinedOutput.includes('Génération terminée')) {
                // Likely a false positive, return the output
                return { stdout: error.stdout || '', stderr: error.stderr || '' };
            }
            
            throw error;
        }
    }

    /**
     * Parse Java backend output to extract information
     */
    parseJavaOutput(output: string): {
        provider?: string;
        resourceCount?: number;
        warnings: string[];
        errors: string[];
        success: boolean;
    } {
        const result = {
            provider: undefined as string | undefined,
            resourceCount: undefined as number | undefined,
            warnings: [] as string[],
            errors: [] as string[],
            success: false
        };

        const lines = output.split('\n');

        // Extract provider
        const providerMatch = output.match(/Provider:\s*(\w+)/i);
        if (providerMatch) {
            result.provider = providerMatch[1];
        }

        // Extract resource count
        const resourceMatch = output.match(/Ressources?:\s*(\d+)|Resources?:\s*(\d+)/i);
        if (resourceMatch) {
            result.resourceCount = parseInt(resourceMatch[1] || resourceMatch[2] || '0', 10);
        }

        // Extract success indicators
        if (output.includes('✓') || 
            output.includes('success') || 
            output.includes('succès') ||
            output.includes('Génération terminée') ||
            output.includes('Generation completed')) {
            result.success = true;
        }

        // Extract errors
        if (output.includes('❌') || output.includes('Erreur:') || output.includes('Error:')) {
            const errorLines = lines.filter(line => 
                line.includes('❌') || 
                line.includes('Erreur:') || 
                line.includes('Error:') ||
                line.includes('Exception') ||
                line.includes('at ')
            );
            result.errors.push(...errorLines);
        }

        // Extract warnings
        if (output.includes('⚠️') || output.includes('Warning:')) {
            const warningLines = lines.filter(line => 
                line.includes('⚠️') || 
                line.includes('Warning:')
            );
            result.warnings.push(...warningLines);
        }

        return result;
    }

    /**
     * Generate infrastructure using Java backend
     */
    async generateInfrastructure(options: JavaBackendOptions): Promise<JavaBackendResult> {
        const { inputJson, outputDir, generateModel = false, modelFileName = 'model.xmi', terraformFileName = 'infrastructure.tf' } = options;

        // Resolve project path
        const projectPath = this.config.get<string>('projectPath', '${workspaceFolder}/..');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        let resolvedProjectPath = projectPath.replace('${workspaceFolder}', workspaceFolder);
        
        if (!path.isAbsolute(resolvedProjectPath)) {
            resolvedProjectPath = path.resolve(workspaceFolder, resolvedProjectPath);
        }

        // Verify project path exists
        if (!fs.existsSync(resolvedProjectPath)) {
            throw new Error(`Project path does not exist: ${resolvedProjectPath}`);
        }

        // Verify pom.xml exists
        const pomPath = path.join(resolvedProjectPath, 'pom.xml');
        if (!fs.existsSync(pomPath)) {
            throw new Error(`pom.xml not found in project path: ${resolvedProjectPath}`);
        }

        // Create temporary input JSON file
        const tempJsonFile = path.join(outputDir, 'temp-input.json');
        fs.writeFileSync(tempJsonFile, JSON.stringify(inputJson, null, 2));
        this.outputChannel.appendLine(`[Input] Created temporary JSON file: ${tempJsonFile}`);

        // Prepare output files
        const outputTfFile = path.join(outputDir, terraformFileName);
        const outputModelFile = generateModel ? path.join(outputDir, modelFileName) : undefined;

        try {
            // Execute Maven command
            this.outputChannel.appendLine('[Backend] Starting infrastructure generation...');
            this.outputChannel.show(true);

            const { stdout, stderr } = await this.executeMavenCommand(
                resolvedProjectPath,
                'generator.JsonFileDemo',
                [tempJsonFile, outputTfFile]
            );

            // Log output
            this.outputChannel.appendLine('[Backend] Output:');
            this.outputChannel.appendLine(stdout);
            if (stderr && !stderr.includes('WARNING')) {
                this.outputChannel.appendLine('[Backend] Errors/Warnings:');
                this.outputChannel.appendLine(stderr);
            }

            // Parse output
            const parsed = this.parseJavaOutput(stdout + '\n' + stderr);

            // Check if output files were created
            const tfExists = fs.existsSync(outputTfFile);
            const modelExists = outputModelFile ? fs.existsSync(outputModelFile) : false;

            // Build result
            const result: JavaBackendResult = {
                success: parsed.success && tfExists,
                terraformFile: tfExists ? outputTfFile : undefined,
                modelFile: modelExists ? outputModelFile : undefined,
                output: stdout,
                provider: parsed.provider,
                resourceCount: parsed.resourceCount,
                warnings: parsed.warnings.length > 0 ? parsed.warnings : undefined
            };

            // Handle errors
            if (parsed.errors.length > 0) {
                result.error = parsed.errors.join('\n');
                result.success = false;
            }

            if (!tfExists) {
                result.error = (result.error || '') + '\nTerraform file was not generated.';
                result.success = false;
            }

            // Clean up temporary file
            if (fs.existsSync(tempJsonFile)) {
                fs.unlinkSync(tempJsonFile);
                this.outputChannel.appendLine(`[Cleanup] Removed temporary file: ${tempJsonFile}`);
            }

            return result;

        } catch (error: any) {
            // Clean up temporary file on error
            if (fs.existsSync(tempJsonFile)) {
                try {
                    fs.unlinkSync(tempJsonFile);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }

            // Parse error message
            let errorMessage = 'Unknown error occurred';
            if (error.message) {
                errorMessage = error.message;
            } else if (error.stderr) {
                errorMessage = error.stderr;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            // Extract Java stack trace if present
            if (error.stdout || error.stderr) {
                const output = (error.stdout || '') + '\n' + (error.stderr || '');
                const parsed = this.parseJavaOutput(output);
                
                if (parsed.errors.length > 0) {
                    errorMessage = parsed.errors.join('\n');
                }
            }

            this.outputChannel.appendLine(`[Error] ${errorMessage}`);
            if (error.stack) {
                this.outputChannel.appendLine(`[Stack] ${error.stack}`);
            }

            return {
                success: false,
                error: errorMessage,
                output: error.stdout || error.stderr || ''
            };
        }
    }

    /**
     * Validate Java/Maven setup
     */
    async validateSetup(): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];
        const mavenPath = this.config.get<string>('mavenPath', 'mvn');
        const javaPath = this.config.get<string>('javaPath', 'java');
        const projectPath = this.config.get<string>('projectPath', '${workspaceFolder}/..');

        // Check Maven
        try {
            const { stdout } = await execAsync(`${mavenPath} --version`, { timeout: 5000 });
            if (!stdout.includes('Apache Maven')) {
                errors.push('Maven version check failed');
            }
        } catch (error) {
            errors.push(`Maven not found or not accessible: ${mavenPath}`);
        }

        // Check Java
        try {
            const { stdout } = await execAsync(`${javaPath} -version`, { timeout: 5000 });
            if (!stdout.includes('version')) {
                errors.push('Java version check failed');
            }
        } catch (error) {
            errors.push(`Java not found or not accessible: ${javaPath}`);
        }

        // Check project path
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        let resolvedProjectPath = projectPath.replace('${workspaceFolder}', workspaceFolder);
        
        if (!path.isAbsolute(resolvedProjectPath)) {
            resolvedProjectPath = path.resolve(workspaceFolder, resolvedProjectPath);
        }

        if (!fs.existsSync(resolvedProjectPath)) {
            errors.push(`Project path does not exist: ${resolvedProjectPath}`);
        } else {
            const pomPath = path.join(resolvedProjectPath, 'pom.xml');
            if (!fs.existsSync(pomPath)) {
                errors.push(`pom.xml not found in: ${resolvedProjectPath}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Show output channel
     */
    showOutput(): void {
        this.outputChannel.show(true);
    }

    /**
     * Clear output channel
     */
    clearOutput(): void {
        this.outputChannel.clear();
    }
}

