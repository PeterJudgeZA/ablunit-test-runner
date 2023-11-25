import { ConfigurationTarget, commands, workspace } from "vscode"
import * as glob from "glob"
import * as path from "path"
import * as Mocha from "mocha"

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

export function getSessionTempDir () {
	if (process.platform === 'win32') {
		return "file:///c:/temp/ablunit"
	} else if(process.platform === 'linux') {
		return "file:///tmp/ablunit"
	} else {
		throw new Error("Unsupported platform: " + process.platform)
	}
}

async function installOpenedgeABLExtension () {
	console.log("[indexCommon.ts] installing riversidesoftware.openedge-abl-lsp extension")
	await commands.executeCommand('workbench.extensions.installExtension', 'riversidesoftware.openedge-abl-lsp').then(() => {
		console.log("[indexCommon.ts] install successful")
	}, (err) => {
		throw new Error("[indexCommon.ts] failed to install extension: " + err)
	})

	console.log("[indexCommon.ts] sleeping for 1s while extension is installed")
	return new Promise( resolve => setTimeout(resolve, 1000))
}

export function getDefaultDLC () {
	if (process.platform === 'linux') {
		return "/psc/dlc"
	}
	return "C:\\Progress\\OpenEdge"
}

export async function setRuntimes (runtimes: IRuntime[]) {
	await installOpenedgeABLExtension()

	console.log("[indexCommon.ts] setting abl.configuration.runtimes")
	await workspace.getConfiguration('abl.configuration').update('runtimes', runtimes, ConfigurationTarget.Global).then(() =>{
		console.log("[indexCommon.ts] abl.configuration.runtimes set successfully")
	}, (err) => {
		throw new Error("[indexCommon.ts] failed to set runtimes: " + err)
	})
}

function setupNyc(projName: string) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const NYC = require("nyc")
	const nyc = new NYC({
		cache: false,
		cwd: path.join(__dirname, "..", ".."),
		reportDir: path.join(__dirname, "..", "..", 'coverage', "coverage_" + projName),
		tempDir: path.join(__dirname, "..", "..", 'coverage', "coverage_" + projName, ".nyc_output"),
		exclude: [
			"node_modules",
			"out/test/**",
			".vscode-test",
		],
		extension: [
			".ts",
			".tsx",
		],
		hookRequire: true,
		hookRunInContext: true,
		hookRunInThisContext: true,
		instrument: true,
		sourceMap: true,
		reporter: [
			'text',
			'lcov'
		],
		require: [
			"ts-node/register",
		]
	});
	nyc.reset()
	nyc.wrap()
	return nyc
}

function setupMocha(projName: string) {
	return new Mocha({
		color: true,
		ui: "tdd",
		timeout: 20000,
		// reporter: 'mocha-junit-reporter',
		// reporterOptions: {
		// 	mochaFile: 'artifacts/mocha_results_' + projName + '.xml'
		// }
		reporter: 'mocha-multi-reporters',
		reporterOptions: {
			reporterEnabled: 'spec, mocha-junit-reporter',
			mochaJunitReporterReporterOptions: {
				mochaFile: 'artifacts/mocha_results_' + projName + '.xml'
			}
		}
	})
}

export function runTests (projName: string) {

	const nyc = setupNyc(projName)
	const mocha = setupMocha(projName)
	const testsRoot = path.resolve(__dirname, "..");
	return new Promise<void>((c, e) => {
		glob("**/**." + projName + ".test.js", {
			cwd: testsRoot
		}, (err, files) => {
			if (err) {
				return e(err);
			}

			// Add files to the test suite
			files.forEach((f) => {
				mocha.addFile(path.resolve(testsRoot, f))
			});

			try {
				// Run the mocha test
				mocha.run(async (failures) => {
					if (nyc) {
						nyc.writeCoverageFile();
						await nyc.report();
					}

					if (failures > 0) {
						console.log(`${failures} tests failed.`)
						e(new Error(`${failures} tests failed.`))
					}
					c();
				});
			} catch (err) {
				console.error('[index_' + projName + '.ts] catch err= ' + err);
				e(err);
			}
		});
	});
}
