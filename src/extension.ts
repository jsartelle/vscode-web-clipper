// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as Mercury from '@postlight/mercury-parser';
import TurndownService from 'turndown';
import { URL, URLSearchParams } from 'url';
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	// console.log('Congratulations, your extension "web-clipper" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('webClipper.clipWebPage', async () => {
		// Prompt for a URL
		const url = await vscode.window.showInputBox({
			prompt: 'Enter a URL to clip',
			placeHolder: 'https://en.wikipedia.org/wiki/URL',
			validateInput: input => {
				try {
					new URL(input);
					return undefined;
				} catch (err) {
					return 'Input must be a valid URL (including the scheme and trailing slashes, such as https://)';
				}
			}
		});

		if (!url) return;

		clipPageAtUrl(url);
	});

	vscode.window.registerUriHandler({
		handleUri: async uri => {
			if (uri.path === '/clip') {
				const params = new URLSearchParams(uri.query);
				if (params.has('url')) {
					clipPageAtUrl(params.get('url') as string);
				} else {
					vscode.window.showErrorMessage('Please provide a URL in the query string (ex. vscode://jsartelle.web-clipper/clip?url=URL).');
				}
			}
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }

async function clipPageAtUrl(url: string) {
	// The code you place here will be executed every time your command is executed

	const configuration = vscode.workspace.getConfiguration();

	// Test if the URL is valid
	try {
		new URL(url);
	} catch (err) {
		vscode.window.showErrorMessage(`Invalid URL: ${url}`);
		return;
	}

	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: 'Clipping web page...'
	}, () => {
		return new Promise((resolve, reject) => {
			// Use Mercury to get the page and extract the main content
			Mercury.parse(url)
				.then(async (result: any) => {
					// Render article content to Markdown
					let markdown = new TurndownService(configuration.get('webClipper.turndownOptions'))
						.turndown(result.content);

					// Interpolate the results into the template string
					let output;
					try {
						output = eval('`' + configuration.get('webClipper.outputTemplate') + '`');
					} catch (err) {
						vscode.window.showErrorMessage(
							'The webClipper.outputTemplate string appears to be invalid.',
							'Open Settings'
						).then(item => {
							if (item === 'Open Settings') {
								vscode.commands.executeCommand('workbench.action.openSettingsJson');
							}
						});
						reject();
						return;
					}

					// Get rid of the progress notification
					resolve();

					// Create and show a new Markdown editor with the article
					const document = await vscode.workspace.openTextDocument({
						content: output,
						language: 'markdown'
					});

					await vscode.window.showTextDocument(document, {
						preview: false
					});

					// Open locked preview to the side automatically
					if (configuration.get('webClipper.autoShowPreviewToSide')) {
						vscode.commands.executeCommand('markdown.showLockedPreviewToSide');
					}
				})
				.catch((err: any) => {
					vscode.window.showErrorMessage('Error getting the page.');
					console.error(err);
					reject();
				});
		});
	});
}