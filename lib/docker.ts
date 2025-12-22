import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper to escape shell arguments
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export async function createAndInitializeContainer(userId: string) {
  try {
    const containerName = `user${userId}`;
    
    console.log(`Creating container: ${containerName}`);
    
    // Run container
    const { stdout: createOutput } = await execAsync(
      `docker run -d --name ${containerName} stellar-sandbox:v2 tail -f /dev/null`
    );
    console.log('Container created:', createOutput.trim());
    
    // Wait a moment for container to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initialize Soroban contract - run command directly in container
    console.log(`Initializing contract in container: ${containerName}`);
    const { stdout: initOutput } = await execAsync(
      `docker exec ${containerName} sh -c "cd / && stellar contract init soroban-hello-world"`
    );
    console.log('Contract initialized:', initOutput);
    
    return {
      success: true,
      containerName,
      message: `Container ${containerName} created and contract initialized`
    };
  } catch (error) {
    console.error('Docker error:', error);
    throw error;
  }
}

export async function deleteContainer(userId: string) {
  try {
    const containerName = `user${userId}`;
    
    console.log(`Deleting container: ${containerName}`);
    
    // Stop container
    await execAsync(`docker stop ${containerName} 2>/dev/null || true`);
    
    // Remove container
    await execAsync(`docker rm ${containerName} 2>/dev/null || true`);
    
    console.log(`Container ${containerName} deleted`);
    
    return {
      success: true,
      containerName,
      message: `Container ${containerName} deleted`
    };
  } catch (error) {
    console.error('Docker error:', error);
    throw error;
  }
}

export async function getContainerFiles(userId: string) {
  try {
    const containerName = `user${userId}`;
    
    console.log(`Getting files from container: ${containerName}`);
    
    // Get files from container - find all files recursively
    const { stdout } = await execAsync(
      `docker exec ${containerName} find /soroban-hello-world -type f 2>/dev/null || echo ""`
    );
    
    const files = stdout
      .trim()
      .split('\n')
      .filter(f => f.length > 0)
      .map(f => f.replace(/^\/soroban-hello-world\//, '')); // Remove the root path prefix
    
    console.log(`Found ${files.length} files`);
    
    return { success: true, files };
  } catch (error) {
    console.error('Docker error:', error);
    throw error;
  }
}

export async function getFileContent(userId: string, filePath: string) {
  try {
    const containerName = `user${userId}`;
    
    console.log(`Reading file: ${filePath} from container: ${containerName}`);
    
    // Read file from container
    const { stdout } = await execAsync(
      `docker exec ${containerName} cat /soroban-hello-world/${filePath}`
    );
    
    return { success: true, content: stdout };
  } catch (error) {
    console.error('Docker error:', error);
    throw error;
  }
}

export async function saveFileContent(userId: string, filePath: string, content: string) {
  try {
    const containerName = `user${userId}`;
    
    console.log(`Saving file: ${filePath} to container: ${containerName}`);
    
    // Write file to container using printf to handle special characters better
    await execAsync(
      `docker exec ${containerName} sh -c "printf %s ${escapeShellArg(content)} > /soroban-hello-world/${filePath}"`
    );
    
    console.log('File saved successfully');
    
    return { success: true, message: 'File saved' };
  } catch (error) {
    console.error('Docker error:', error);
    throw error;
  }
}
