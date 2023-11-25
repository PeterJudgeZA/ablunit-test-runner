import * as assert from 'assert';
import { after, before } from 'mocha';
import * as vscode from 'vscode';
import { doesFileExist } from '../common'

const projName = 'proj2'

before(async () => {
    console.log("before")
})

after(() => {
	console.log("after")
})

suite('Extension Test Suite - ' + projName, () => {

	test('temp/ablunit.json file exists', async () => {
		const ablunitJson = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'temp','ablunit.json')

		await vscode.commands.executeCommand('testing.refreshTests');
		await vscode.commands.executeCommand('workbench.view.testing.focus')

		console.log("sleeping for 2s while tests are discovered") //There's gotta be a better way to do this...
		await new Promise( resolve => setTimeout(resolve, 2000))

		await vscode.commands.executeCommand('testing.runAll').then(() => {
			console.log("testing.runAll complete!")
		} , (err) => {
			assert.fail("testing.runAll failed: " + err)
		})

		assert(await doesFileExist(ablunitJson),"missing ablunit.json (" + ablunitJson.fsPath + ")")
	})

})
