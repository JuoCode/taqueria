import { execCmd, getArch, sendAsyncErr, sendRes, spawnCmd } from '@taqueria/node-sdk';
import { readJsonFile, writeJsonFile } from '@taqueria/node-sdk';
import { join } from 'path';
import { Common, configure, LigoOpts as Opts } from './common';

const getArbitraryLigoCmd = (
	commonObj: Common,
	parsedArgs: Opts,
	uid: string,
	gid: string,
	userArgs: string,
): [string, Record<string, string>] => {
	const projectDir = process.env.PROJECT_DIR ?? parsedArgs.projectDir;
	if (!projectDir) throw `No project directory provided`;

	const userMap = uid && gid ? `${uid}:${gid}` : uid;
	const userMapArgs = uid ? ['-u', userMap] : [];

	const binary = 'docker';
	const baseArgs = [
		'run',
		'--rm',
		'-v',
		`${projectDir}:/project`,
		'-w',
		'/project',
		...userMapArgs,
		commonObj.getLigoDockerImage(),
	];
	const processedUserArgs = userArgs.split(' ').map(arg => arg.startsWith('\\-') ? arg.substring(1) : arg).filter(arg =>
		arg
	);
	const args = [...baseArgs, ...processedUserArgs, '--skip-analytics'];
	const envVars = { 'DOCKER_DEFAULT_PLATFORM': 'linux/amd64' };
	return [
		[binary, ...args].join(' '),
		envVars,
	];
};

const runArbitraryLigoCmd = (commonObj: Common, parsedArgs: Opts, cmd: string): Promise<string> =>
	(async () => {
		const uid = await execCmd('id -u');
		const gid = await execCmd('id -g');
		return [uid.stdout.trim(), gid.stdout.trim()];
	})()
		.then(([uid, gid]) => getArbitraryLigoCmd(commonObj, parsedArgs, uid, gid, cmd))
		.then(([cmd, envVars]) => spawnCmd(cmd, envVars))
		.then(code =>
			code !== null && code === 0
				? `Command "${cmd}" ran successfully by LIGO`
				: `Command "${cmd}" failed. Please check your command`
		)
		.catch(err => sendAsyncErr(`An internal error has occurred: ${err.message}`));

const ligo = (commonObj: Common, parsedArgs: Opts): Promise<void> => {
	const args = parsedArgs.command;
	return runArbitraryLigoCmd(commonObj, parsedArgs, args).then(sendRes).catch(err => sendAsyncErr(err, false));
};

export default ligo;
