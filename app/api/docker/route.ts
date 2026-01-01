import { NextResponse } from 'next/server';
import {
createAndInitializeContainer,
deleteContainer,
getContainerFiles,
getFileContent,
saveFileContent,
createFile,
createFolder,
deleteFile,
deleteFolder,
createAccount,
deployContract,
buildContract
} from '@/lib/docker';
import {
getAllProjects,
createProject,
deleteProject,
getProject,
renameProject
} from '@/lib/projects';

export async function POST(request: Request) {
try {
const { action, userId, filePath, content, publicKey, projectName, description, oldName, newName } = await request.json();
switch (action) {
  case 'create':
    const createResult = await createAndInitializeContainer(userId);
    return NextResponse.json(createResult);

  case 'delete':
    const deleteResult = await deleteContainer(userId);
    return NextResponse.json(deleteResult);

  case 'getFiles':
    const filesResult = await getContainerFiles(userId, projectName);
    return NextResponse.json(filesResult);

  case 'getFileContent':
    const fileContentResult = await getFileContent(userId, filePath, projectName);
    return NextResponse.json(fileContentResult);

  case 'saveFileContent':
    const saveResult = await saveFileContent(userId, filePath, content, projectName);
    return NextResponse.json(saveResult);

  case 'createFile':
    const createFileResult = await createFile(userId, filePath, '', projectName);
    return NextResponse.json(createFileResult);

  case 'createFolder':
    const createFolderResult = await createFolder(userId, filePath, projectName);
    return NextResponse.json(createFolderResult);

  case 'deleteFile':
    const deleteFileResult = await deleteFile(userId, filePath, projectName);
    return NextResponse.json(deleteFileResult);

  case 'deleteFolder':
    const deleteFolderResult = await deleteFolder(userId, filePath, projectName);
    return NextResponse.json(deleteFolderResult);
  
  case 'createAccount':
    const createAccountResult = await createAccount(userId);
    return NextResponse.json(createAccountResult);

  case 'deployContract':
    const deployContractResult = await deployContract(userId, publicKey, projectName);
    return NextResponse.json(deployContractResult);

  case 'buildContract':
    const buildContractResult = await buildContract(userId, projectName);
    return NextResponse.json(buildContractResult);

  // Project management endpoints
  case 'getAllProjects':
    const allProjects = await getAllProjects(userId);
    return NextResponse.json({ success: true, projects: allProjects });

  case 'createProject':
    const createProjectResult = await createProject(userId, projectName, description);
    return NextResponse.json(createProjectResult);

  case 'deleteProject':
    const deleteProjectResult = await deleteProject(userId, projectName);
    return NextResponse.json(deleteProjectResult);

  case 'getProject':
    const getProjectResult = await getProject(userId, projectName);
    return NextResponse.json(getProjectResult);

  case 'renameProject':
    const renameProjectResult = await renameProject(userId, oldName, newName);
    return NextResponse.json(renameProjectResult);

  default:
    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
}
} catch (error) {
console.error('API error:', error);
return NextResponse.json(
{ error: 'Internal server error', details: String(error) },
{ status: 500 }
);
}
}