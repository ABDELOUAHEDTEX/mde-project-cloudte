import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { JavaBackend } from './javaBackend';
import { StatusBarManager } from './statusBar';
import { NLPCodeLensProvider } from './codeLensProvider';
import { SplitViewProvider } from './splitViewProvider';
import { ModelPreviewProvider } from './webviewProvider';

// Cloud resource types and keywords for autocompletion
const RESOURCE_TYPES = [
    'VPC', 'Subnet', 'SecurityGroup', 'LoadBalancer', 'RouteTable', 'NetworkInterface',
    'ComputeInstance', 'EC2', 'AutoScalingGroup', 'ContainerService', 'ECS', 'EKS',
    'Function', 'Lambda', 'Volume', 'EBS', 'StorageBucket', 'S3', 'FileSystem', 'EFS',
    'DatabaseInstance', 'RDS', 'NoSQLDatabase', 'DynamoDB', 'IAMRole', 'IAMPolicy',
    'Secret', 'MonitoringService'
];

const PROVIDERS = ['AWS', 'Azure', 'GCP', 'Google Cloud Platform', 'Amazon Web Services', 'Microsoft Azure'];

const ATTRIBUTES = [
    'name', 'region', 'zone', 'availability zone', 'AZ', 'CIDR', 'cidr', 'IP', 'ip', 'address',
    'port', 'protocol', 'OS', 'os', 'operating system', 'image', 'AMI', 'ami', 'instance type',
    'size', 'capacity', 'engine', 'version', 'storage', 'encrypted', 'encryption', 'public',
    'private', 'subnet', 'security group', 'tags', 'tag', 'min', 'max', 'desired', 'minSize',
    'maxSize', 'desiredCapacity', 'cluster', 'container', 'runtime', 'trigger', 'throughput',
    'replica', 'multi-AZ', 'multiAZ', 'versioning', 'publicAccess', 'inbound', 'outbound',
    'rules', 'routes', 'assumeRole', 'actions', 'resources', 'key', 'metrics'
];

const KEYWORDS = [
    'create', 'add', 'deploy', 'configure', 'setup', 'with', 'in', 'on', 'for', 'to', 'from',
    'using', 'via', 'connect', 'link', 'attach', 'enable', 'disable', 'allow', 'deny'
];

// Global instances
let javaBackend: JavaBackend;
let statusBarManager: StatusBarManager;

// Global context (needed for split view)
let context: vscode.ExtensionContext;

/**
 * Extension activation function
 */
export function activate(extensionContext: vscode.ExtensionContext) {
    context = extensionContext;
    console.log('CloudInfraGen extension is now active!');

    // Initialize Java backend
    javaBackend = new JavaBackend();

    // Initialize status bar
    statusBarManager = new StatusBarManager();
    context.subscriptions.push(statusBarManager);

    // Register CodeLens provider for .nlp files
    const codeLensProvider = new NLPCodeLensProvider();
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: 'file', language: 'nlp' },
        codeLensProvider
    );
    context.subscriptions.push(codeLensDisposable);

    // Register webview provider for model preview
    const previewProvider = new ModelPreviewProvider(context.extensionUri, context);
    const previewDisposable = vscode.window.registerWebviewViewProvider(
        ModelPreviewProvider.viewType,
        previewProvider
    );
    context.subscriptions.push(previewDisposable);

    // Register command: Generate from JSON
    const generateCommand = vscode.commands.registerCommand(
        'cloudinfragen.generate',
        async () => {
            await generateFromJson();
        }
    );

    // Register command: Generate from File
    const generateFromFileCommand = vscode.commands.registerCommand(
        'cloudinfragen.generateFromFile',
        async () => {
            await generateFromFile();
        }
    );

    // Register command: Validate Setup
    const validateSetupCommand = vscode.commands.registerCommand(
        'cloudinfragen.validateSetup',
        async () => {
            await validateSetup();
        }
    );

    // Register command: Show Output
    const showOutputCommand = vscode.commands.registerCommand(
        'cloudinfragen.showOutput',
        () => {
            javaBackend.showOutput();
        }
    );

    // Register command: Generate from NLP file
    const generateFromNLPCommand = vscode.commands.registerCommand(
        'cloudinfragen.generateFromNLP',
        async (filePath: string) => {
            await generateFromNLPFile(filePath);
        }
    );

    // Register command: Open Split View
    const openSplitViewCommand = vscode.commands.registerCommand(
        'cloudinfragen.openSplitView',
        async (filePath?: string) => {
            await openSplitView(filePath);
        }
    );

    // Register completion provider for .nlp files
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', language: 'nlp' },
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const completions: vscode.CompletionItem[] = [];

                // Add resource types
                RESOURCE_TYPES.forEach(resource => {
                    const item = new vscode.CompletionItem(resource, vscode.CompletionItemKind.Class);
                    item.detail = 'Cloud Resource Type';
                    item.documentation = `Create a ${resource} resource`;
                    completions.push(item);
                });

                // Add providers
                PROVIDERS.forEach(provider => {
                    const item = new vscode.CompletionItem(provider, vscode.CompletionItemKind.Module);
                    item.detail = 'Cloud Provider';
                    completions.push(item);
                });

                // Add attributes
                ATTRIBUTES.forEach(attr => {
                    const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
                    item.detail = 'Resource Attribute';
                    completions.push(item);
                });

                // Add keywords
                KEYWORDS.forEach(keyword => {
                    const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
                    item.detail = 'Keyword';
                    completions.push(item);
                });

                return completions;
            }
        }
    );

    // Register diagnostic provider for .nlp files
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('nlp');
    context.subscriptions.push(diagnosticCollection);

    // Validate .nlp files on document change
    const validateDocument = (document: vscode.TextDocument) => {
        if (document.languageId === 'nlp') {
            const diagnostics: vscode.Diagnostic[] = [];
            const text = document.getText();
            const lines = text.split('\n');

            lines.forEach((line, index) => {
                // Check for common issues
                const lineNumber = index;
                const trimmedLine = line.trim().toLowerCase();

                // Check for invalid resource references
                if (trimmedLine.includes('subnet:') || trimmedLine.includes('security group:')) {
                    const match = trimmedLine.match(/(subnet|security group):\s*([^\s,]+)/);
                    if (match && match[2]) {
                        const refName = match[2];
                        // Simple validation: check if reference is mentioned earlier
                        const linesBefore = lines.slice(0, index).join('\n').toLowerCase();
                        const refIndex = line.toLowerCase().indexOf(match[2].toLowerCase());
                        if (refIndex >= 0 && !linesBefore.includes(refName.toLowerCase()) && !refName.startsWith('$')) {
                            const range = new vscode.Range(
                                lineNumber,
                                refIndex,
                                lineNumber,
                                refIndex + match[2].length
                            );
                            diagnostics.push({
                                range,
                                severity: vscode.DiagnosticSeverity.Warning,
                                message: `Reference "${refName}" may not be defined`,
                                source: 'nlp'
                            });
                        }
                    }
                }

                // Check for missing required attributes
                if (trimmedLine.includes('create') && trimmedLine.includes('ec2')) {
                    if (!trimmedLine.includes('name') && !trimmedLine.includes('subnet')) {
                        const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
                        diagnostics.push({
                            range,
                            severity: vscode.DiagnosticSeverity.Information,
                            message: 'Consider specifying name and subnet for EC2 instance',
                            source: 'nlp'
                        });
                    }
                }
            });

            diagnosticCollection.set(document.uri, diagnostics);
        }
    };

    // Validate on document open and change
    if (vscode.window.activeTextEditor) {
        validateDocument(vscode.window.activeTextEditor.document);
    }

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
        validateDocument(e.document);
    });

    const openDocumentSubscription = vscode.workspace.onDidOpenTextDocument(validateDocument);

    context.subscriptions.push(
        generateCommand,
        generateFromFileCommand,
        generateFromNLPCommand,
        openSplitViewCommand,
        validateSetupCommand,
        showOutputCommand,
        completionProvider,
        changeDocumentSubscription,
        openDocumentSubscription
    );
}

/**
 * Extension deactivation function
 */
export function deactivate() {
    // Cleanup if needed
}

/**
 * Generate infrastructure from JSON input
 */
async function generateFromJson() {
    try {
        // Get JSON input from user
        const jsonInput = await vscode.window.showInputBox({
            prompt: 'Enter JSON infrastructure definition',
            placeHolder: '{"provider": "AWS", "resources": [...]}',
            validateInput: (value) => {
                try {
                    JSON.parse(value);
                    return null;
                } catch (e) {
                    return 'Invalid JSON format';
                }
            }
        });

        if (!jsonInput) {
            return;
        }

        // Parse JSON
        const jsonData = JSON.parse(jsonInput);

        // Get output directory
        const outputDir = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Output Directory'
        });

        if (!outputDir || outputDir.length === 0) {
            return;
        }

        // Generate infrastructure
        await executeGeneration(jsonData, outputDir[0].fsPath);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        javaBackend.showOutput();
    }
}

/**
 * Generate infrastructure from a JSON file
 */
async function generateFromFile() {
    try {
        // Select input JSON file
        const inputFile = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Select JSON Input File',
            filters: {
                'JSON files': ['json']
            }
        });

        if (!inputFile || inputFile.length === 0) {
            return;
        }

        const inputPath = inputFile[0].fsPath;

        // Read JSON file
        const jsonContent = fs.readFileSync(inputPath, 'utf8');
        const jsonData = JSON.parse(jsonContent);

        // Get output directory (default to same directory as input)
        const outputDir = path.dirname(inputPath);

        // Generate infrastructure
        await executeGeneration(jsonData, outputDir, inputPath);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        javaBackend.showOutput();
    }
}

/**
 * Execute the Java generation process
 */
async function executeGeneration(jsonData: any, outputDir: string, nlpFilePath?: string) {
    // Update status bar
    statusBarManager.showGenerating();

    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating infrastructure",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: 'Preparing...' });

        try {
            // Generate infrastructure using Java backend
            progress.report({ increment: 30, message: 'Calling Java backend...' });
            const result = await javaBackend.generateInfrastructure({
                inputJson: jsonData,
                outputDir: outputDir,
                terraformFileName: 'infrastructure.tf'
            });

            progress.report({ increment: 80, message: 'Processing results...' });

            // Update status bar
            if (result.success) {
                statusBarManager.showSuccess(result.provider, result.resourceCount);
            } else {
                statusBarManager.showError(result.error);
            }

            // Display results
            if (result.success) {
                progress.report({ increment: 100, message: 'Complete!' });

                // Read Terraform file if generated
                let terraformContent = '';
                if (result.terraformFile && fs.existsSync(result.terraformFile)) {
                    terraformContent = fs.readFileSync(result.terraformFile, 'utf8');
                }

                // Build success message
                let message = 'Infrastructure generated successfully!';
                if (result.provider) {
                    message += `\nProvider: ${result.provider}`;
                }
                if (result.resourceCount !== undefined) {
                    message += `\nResources: ${result.resourceCount}`;
                }

                // Show notification with actions
                const action = await vscode.window.showInformationMessage(
                    message,
                    'Open Terraform File',
                    'Open Split View',
                    'Open Output'
                );

                if (action === 'Open Terraform File' && result.terraformFile) {
                    const doc = await vscode.workspace.openTextDocument(result.terraformFile);
                    await vscode.window.showTextDocument(doc);
                } else if (action === 'Open Split View') {
                    // Open split view with NLP and Terraform
                    const nlpContent = nlpFilePath ? fs.readFileSync(nlpFilePath, 'utf8') : JSON.stringify(jsonData, null, 2);
                    await SplitViewProvider.createSplitView(
                        nlpContent,
                        terraformContent,
                        nlpFilePath,
                        result.terraformFile
                    );
                } else if (action === 'Open Output') {
                    javaBackend.showOutput();
                }

                // Show warnings if any
                if (result.warnings && result.warnings.length > 0) {
                    vscode.window.showWarningMessage(
                        `Generation completed with ${result.warnings.length} warning(s). Check output for details.`
                    );
                }
            } else {
                // Show error
                const errorMessage = result.error || 'Unknown error occurred';
                vscode.window.showErrorMessage(
                    `Generation failed: ${errorMessage}`,
                    'Show Details'
                ).then(action => {
                    if (action === 'Show Details') {
                        javaBackend.showOutput();
                    }
                });
            }
        } catch (error: any) {
            statusBarManager.showError(error.message);
            const errorMessage = error.message || 'Unknown error occurred';
            vscode.window.showErrorMessage(
                `Error: ${errorMessage}`,
                'Show Details'
            ).then(action => {
                if (action === 'Show Details') {
                    javaBackend.showOutput();
                }
            });
            throw error;
        }
    });
}

/**
 * Generate infrastructure from NLP file
 */
async function generateFromNLPFile(filePath: string) {
    try {
        // Read NLP file
        const nlpContent = fs.readFileSync(filePath, 'utf8');
        
        // For now, we'll need to convert NLP to JSON
        // This is a placeholder - in a real implementation, you'd parse the NLP file
        // For now, we'll show an error if it's not JSON
        let jsonData: any;
        try {
            jsonData = JSON.parse(nlpContent);
        } catch (e) {
            // If not JSON, show message that NLP parsing is not yet implemented
            vscode.window.showWarningMessage(
                'NLP file parsing is not yet implemented. Please use JSON format for now.',
                'OK'
            );
            return;
        }

        // Get output directory (default to same directory as input)
        const outputDir = path.dirname(filePath);

        // Generate infrastructure
        await executeGeneration(jsonData, outputDir, filePath);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        javaBackend.showOutput();
        statusBarManager.showError(error.message);
    }
}

/**
 * Open split view with NLP and Terraform
 */
async function openSplitView(nlpFilePath?: string) {
    try {
        let nlpContent = '';
        let terraformContent = '';
        let terraformFilePath: string | undefined;

        // Get NLP content
        if (nlpFilePath && fs.existsSync(nlpFilePath)) {
            nlpContent = fs.readFileSync(nlpFilePath, 'utf8');
        } else {
            // Try to get from active editor
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.languageId === 'nlp') {
                nlpContent = activeEditor.document.getText();
                nlpFilePath = activeEditor.document.uri.fsPath;
            } else {
                vscode.window.showWarningMessage('No NLP file is currently open.');
                return;
            }
        }

        // Try to find corresponding Terraform file
        if (nlpFilePath) {
            const dir = path.dirname(nlpFilePath);
            terraformFilePath = path.join(dir, 'infrastructure.tf');
            if (fs.existsSync(terraformFilePath)) {
                terraformContent = fs.readFileSync(terraformFilePath, 'utf8');
            }
        }

        // If no Terraform file exists, show message
        if (!terraformContent) {
            vscode.window.showInformationMessage(
                'No Terraform file found. Generate infrastructure first.',
                'Generate Now'
            ).then(action => {
                if (action === 'Generate Now' && nlpFilePath) {
                    generateFromNLPFile(nlpFilePath);
                }
            });
        }

        // Open split view
        await SplitViewProvider.createSplitView(
            nlpContent,
            terraformContent,
            nlpFilePath,
            terraformFilePath
        );
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
}

/**
 * Validate Java/Maven setup
 */
async function validateSetup() {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Validating setup",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: 'Checking Java...' });
        const validation = await javaBackend.validateSetup();

        progress.report({ increment: 100, message: 'Complete!' });

        if (validation.valid) {
            vscode.window.showInformationMessage('Setup validation passed! Java and Maven are configured correctly.');
        } else {
            const errorMessage = `Setup validation failed:\n${validation.errors.join('\n')}`;
            vscode.window.showErrorMessage(errorMessage, 'Show Output').then(action => {
                if (action === 'Show Output') {
                    javaBackend.showOutput();
                }
            });
        }
    });
}

