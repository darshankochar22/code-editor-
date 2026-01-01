import EditorComponent from "@/app/editor/Editor";

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projectName = params.project || undefined;
  return <EditorComponent projectName={projectName} />;
}
