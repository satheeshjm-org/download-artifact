import * as core from '@actions/core'
import * as artifact from '@actions/artifact'
import * as os from 'os'
import {resolve} from 'path'
import {Inputs, Outputs} from './constants'

const retry = core.getInput(Inputs.Retry, {required: false}) === 'true'
const retryTimeout = parseInt(
  core.getInput(Inputs.RetryTimeout, {required: false}) || '60'
)
const retryInterval = parseInt(
  core.getInput(Inputs.RetryInterval, {required: false}) || '1'
)

const startTime = new Date().getTime()

const sleep = t => new Promise(s => setTimeout(s, t))
async function run(): Promise<void> {
  try {
    const name = core.getInput(Inputs.Name, {required: false})
    const path = core.getInput(Inputs.Path, {required: false})

    let resolvedPath
    // resolve tilde expansions, path.replace only replaces the first occurrence of a pattern
    if (path.startsWith(`~`)) {
      resolvedPath = resolve(path.replace('~', os.homedir()))
    } else {
      resolvedPath = resolve(path)
    }
    core.debug(`Resolved path is ${resolvedPath}`)

    const artifactClient = artifact.create()
    if (!name) {
      // download all artifacts
      core.info('No artifact name specified, downloading all artifacts')
      core.info(
        'Creating an extra directory for each artifact that is being downloaded'
      )
      const downloadResponse = await artifactClient.downloadAllArtifacts(
        resolvedPath
      )
      core.info(`There were ${downloadResponse.length} artifacts downloaded`)
      for (const artifact of downloadResponse) {
        core.info(
          `Artifact ${artifact.artifactName} was downloaded to ${artifact.downloadPath}`
        )
      }
    } else {
      // download a single artifact
      core.info(`Starting download for ${name}`)
      const downloadOptions = {
        createArtifactFolder: false
      }
      const downloadResponse = await artifactClient.downloadArtifact(
        name,
        resolvedPath,
        downloadOptions
      )
      core.info(
        `Artifact ${downloadResponse.artifactName} was downloaded to ${downloadResponse.downloadPath}`
      )
    }
    // output the directory that the artifact(s) was/were downloaded to
    // if no path is provided, an empty string resolves to the current working directory
    core.setOutput(Outputs.DownloadPath, resolvedPath)
    core.info('Artifact download has finished successfully')
  } catch (err) {
    core.error(err.message)
    if (retry) {
      const now = new Date().getTime()
      if (now <= startTime + retryTimeout * 1000) {
        core.info(`Retrying download`)
        await sleep(retryInterval * 1000)
        await run()
        return
      }
    }
    core.setFailed(err.message)
  }
}

run()
