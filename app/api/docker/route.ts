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

export async function POST(request: Request) {
try {
const { action, userId, filePath, content, publicKey } = await request.json();
switch (action) {
  case 'create':
    const createResult = await createAndInitializeContainer(userId);
    return NextResponse.json(createResult);

  case 'delete':
    const deleteResult = await deleteContainer(userId);
    return NextResponse.json(deleteResult);

  case 'getFiles':
    const filesResult = await getContainerFiles(userId);
    return NextResponse.json(filesResult);

  case 'getFileContent':
    const fileContentResult = await getFileContent(userId, filePath);
    return NextResponse.json(fileContentResult);

  case 'saveFileContent':
    const saveResult = await saveFileContent(userId, filePath, content);
    return NextResponse.json(saveResult);

  case 'createFile':
    const createFileResult = await createFile(userId, filePath);
    return NextResponse.json(createFileResult);

  case 'createFolder':
    const createFolderResult = await createFolder(userId, filePath);
    return NextResponse.json(createFolderResult);

  case 'deleteFile':
    const deleteFileResult = await deleteFile(userId, filePath);
    return NextResponse.json(deleteFileResult);

  case 'deleteFolder':
    const deleteFolderResult = await deleteFolder(userId, filePath);
    return NextResponse.json(deleteFolderResult);
  
  case 'createAccount':
    const createAccountResult = await createAccount(userId);
    return NextResponse.json(createAccountResult);

  case 'deployContract':
    const deployContractResult = await deployContract(userId, publicKey);
    return NextResponse.json(deployContractResult);

  case 'buildContract':
    const buildContractResult = await buildContract(userId);
    return NextResponse.json(buildContractResult);

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