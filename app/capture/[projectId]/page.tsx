'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getProject } from '@/app/lib/db';
import { Project } from '@/app/lib/types';
import CaptureInterface from '@/app/components/CaptureInterface';

export default function CapturePage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const projectId = params.projectId as string;
        const proj = await getProject(projectId);

        if (!proj) {
          alert('Project not found');
          router.push('/');
          return;
        }

        setProject(proj);
      } catch (error) {
        console.error('Failed to load project:', error);
        alert('Failed to load project');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [params.projectId, router]);

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        Loading project...
      </div>
    );
  }

  return <CaptureInterface project={project} />;
}
