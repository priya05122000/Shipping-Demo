import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { ToastProvider } from "@/components/ui/Toast";
import { ProjectsHome } from "./_components/ProjectsHome";

export default function Home() {
  return (
    <ToastProvider>
      <DashboardFrame>
        <ProjectsHome />
      </DashboardFrame>
    </ToastProvider>
  );
}
