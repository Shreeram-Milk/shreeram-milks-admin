import { cn } from "cn"
import { tc } from "@/lib/i18n/common"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label={tc('loading')}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
