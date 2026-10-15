import { notFound } from "next/navigation";
import { repo } from "@/lib/repository";
import { ProjectView } from "@/components/ProjectView";
export const dynamic = "force-dynamic";
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const project = await repo.getProject(id); if (!project) notFound(); return <div className="page"><ProjectView initial={project} /></div>; }
