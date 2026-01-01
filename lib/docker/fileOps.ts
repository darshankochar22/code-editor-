/**
 * Docker File Operations
 * 
 * Handles file reading, writing, and deletion within Docker containers
 */

import {
  execAsync,
  getContainerName,
  getWorkspacePath,
  escapeFilePath,
  escapeShellArg,
} from './utils';

/**
 * Get all files from container project directory
 * @param userId The user ID
 * @param projectName Optional specific project to filter files from
 * @returns List of files
 */
export async function getContainerFiles(userId: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    console.log(`Getting files from container: ${containerName}, project: ${projectName}`);

    // Verify container is running
    const { stdout: statusCheck } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${containerName} 2>/dev/null || echo "false"`
    );

    if (statusCheck.trim() !== 'true') {
      throw new Error('Container is not running');
    }

    const workspacePath = getWorkspacePath();
    
    // If no projectName, we need one
    if (!projectName) {
      return {
        success: true,
        files: [],
        message: 'Please select a project to open',
      };
    }

    const searchPath = `${workspacePath}/${projectName}`;
    console.log(`Searching for files in: ${searchPath}`);

    // Check if project exists
    const { stdout: projectExists } = await execAsync(
      `docker exec ${containerName} test -d ${searchPath} && echo "exists" || echo "missing"`
    );

    if (projectExists.trim() !== 'exists') {
      return {
        success: true,
        files: [],
        message: `Project ${projectName} not found`,
      };
    }

    // Get files from container - find all files recursively
    const { stdout } = await execAsync(
      `docker exec ${containerName} find ${searchPath} -type f 2>/dev/null`,
      { timeout: 10000 }
    );

    // Parse the output and filter out unwanted paths
    let allFiles = stdout
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)
      .map((f) => f.replace(`${searchPath}/`, ''))
      // Filter out build artifacts
      .filter((f) => !f.includes('/target/') && !f.includes('/.git/') && f !== 'Cargo.lock' && f !== 'projects.json');

    console.log(`Found ${allFiles.length} files in ${searchPath}`);
    console.log('Files list:', allFiles);
    return { success: true, files: allFiles };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to get files',
      files: [],
    };
  }
}

/**
 * Get content of a specific file
 * @param userId The user ID
 * @param filePath The relative file path
 * @param projectName Optional specific project
 * @returns File content
 */
export async function getFileContent(userId: string, filePath: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const safePath = escapeFilePath(filePath);
    console.log(`Reading file: ${safePath} from container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;
    console.log(`Full path for reading: ${fullPath}`);

    // Verify file exists first
    const { stdout: fileExists } = await execAsync(
      `docker exec ${containerName} test -f ${fullPath} && echo "exists" || echo "missing"`
    );

    if (fileExists.trim() !== 'exists') {
      console.error(`File not found: ${fullPath}`);
      throw new Error(`File does not exist at ${fullPath}`);
    }

    // Read file from container
    const { stdout } = await execAsync(
      `docker exec ${containerName} cat ${fullPath}`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB max file size
    );

    return { success: true, content: stdout };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to read file',
      content: '',
    };
  }
}

/**
 * Save content to a file
 * @param userId The user ID
 * @param filePath The relative file path
 * @param content The file content to save
 * @param projectName Optional specific project
 * @returns Save result
 */
export async function saveFileContent(userId: string, filePath: string, content: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const safePath = escapeFilePath(filePath);
    console.log(`Saving file: ${safePath} to container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;
    console.log(`Full path: ${fullPath}`);

    // First verify the file exists
    const { stdout: fileCheck } = await execAsync(
      `docker exec ${containerName} test -f ${fullPath} && echo "exists" || echo "missing"`
    );

    if (fileCheck.trim() === 'missing') {
      console.error(`File not found at: ${fullPath}`);
      // Try to show what files exist
      const { stdout: dirContents } = await execAsync(
        `docker exec ${containerName} find ${basePath} -name "lib.rs" 2>/dev/null || true`
      );
      console.log('Found lib.rs at:', dirContents);
      return {
        success: false,
        error: `File not found at ${fullPath}. Try refreshing the file tree.`,
      };
    }

    // Escape content for shell - use base64 encoding to avoid shell escaping issues
    const base64Content = Buffer.from(content).toString('base64');

    // Write file to container using base64 decoding
    await execAsync(
      `docker exec -u developer ${containerName} sh -c "echo ${escapeShellArg(
        base64Content
      )} | base64 -d > ${fullPath}"`,
      { timeout: 10000 }
    );

    console.log('File saved successfully');
    return { success: true, message: 'File saved' };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to save file',
    };
  }
}

/**
 * Delete a file from the container
 * @param userId The user ID
 * @param filePath The relative file path
 * @param projectName Optional specific project
 * @returns Deletion result
 */
export async function deleteFile(userId: string, filePath: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const safePath = escapeFilePath(filePath);
    console.log(`Deleting file: ${safePath} from container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;

    // Verify file exists
    const { stdout: fileCheck } = await execAsync(
      `docker exec ${containerName} test -f ${fullPath} && echo "exists" || echo "missing"`
    );

    if (fileCheck.trim() !== 'exists') {
      throw new Error(`File does not exist: ${fullPath}`);
    }

    // Delete file
    await execAsync(`docker exec -u developer ${containerName} rm ${fullPath}`);

    console.log(`File deleted: ${fullPath}`);
    return {
      success: true,
      message: `File ${filePath} deleted`,
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to delete file',
    };
  }
}

/**
 * Delete a folder from the container
 * @param userId The user ID
 * @param folderPath The relative folder path
 * @param projectName Optional specific project
 * @returns Deletion result
 */
export async function deleteFolder(userId: string, folderPath: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const safePath = escapeFilePath(folderPath);
    console.log(`Deleting folder: ${safePath} from container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;

    // Verify folder exists
    const { stdout: folderCheck } = await execAsync(
      `docker exec ${containerName} test -d ${fullPath} && echo "exists" || echo "missing"`
    );

    if (folderCheck.trim() !== 'exists') {
      throw new Error(`Folder does not exist: ${fullPath}`);
    }

    // Delete folder recursively
    await execAsync(`docker exec -u developer ${containerName} rm -rf ${fullPath}`);

    console.log(`Folder deleted: ${fullPath}`);
    return {
      success: true,
      message: `Folder ${folderPath} deleted`,
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to delete folder',
    };
  }
}

/**
 * Create a new file in the container
 * @param userId The user ID
 * @param filePath The relative file path
 * @param content The initial file content
 * @param projectName Optional specific project
 * @returns Creation result
 */
export async function createFile(userId: string, filePath: string, content: string = '', projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const safePath = escapeFilePath(filePath);
    console.log(`Creating file: ${safePath} in container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;

    // Create parent directories if needed
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await execAsync(`docker exec -u developer ${containerName} mkdir -p ${dir}`);

    // Create file with content (or empty if no content)
    if (content) {
      const base64Content = Buffer.from(content).toString('base64');
      await execAsync(
        `docker exec -u developer ${containerName} sh -c "echo ${escapeShellArg(
          base64Content
        )} | base64 -d > ${fullPath}"`
      );
    } else {
      await execAsync(`docker exec -u developer ${containerName} touch ${fullPath}`);
    }

    console.log(`File created: ${fullPath}`);
    return {
      success: true,
      message: `File ${filePath} created`,
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to create file',
    };
  }
}

/**
 * Create a folder in the container
 * @param userId The user ID
 * @param folderPath The path of the folder to create
 * @param projectName Optional specific project
 * @returns Success or error
 */
export async function createFolder(userId: string, folderPath: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const safePath = escapeFilePath(folderPath);
    console.log(`Creating folder: ${safePath} in container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;

    // Create folder recursively
    await execAsync(`docker exec -u developer ${containerName} mkdir -p ${fullPath}`);

    console.log(`Folder created: ${fullPath}`);
    return {
      success: true,
      message: `Folder ${folderPath} created`,
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to create folder',
    };
  }
}

