import { ConfigurationShell } from '../../components/layout/ConfigurationShell'

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <ConfigurationShell>{children}</ConfigurationShell>
}
