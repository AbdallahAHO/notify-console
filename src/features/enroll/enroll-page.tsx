import { useNavigate } from "@tanstack/react-router"
import { PageHeader } from "@/app/page"
import type { EnrollMethod } from "@/app/router"
import { RequireKey } from "@/app/states"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PairingForm } from "./pairing/pairing-form"
import { UsbForm } from "./usb/usb-form"
import { WebhookForm } from "./webhook/webhook-form"

export const EnrollPage = ({ method }: { method: EnrollMethod }) => {
  const navigate = useNavigate()
  return (
    <>
      <PageHeader
        title="Enroll"
        description="Add a destination: a device over USB, a device showing a pairing code, or a webhook."
      />
      <RequireKey>
        <Tabs
          value={method}
          onValueChange={(value) =>
            navigate({
              to: "/enroll",
              search: { method: value as EnrollMethod },
            })
          }
          className="gap-5 p-6"
        >
          <TabsList>
            <TabsTrigger value="usb">USB</TabsTrigger>
            <TabsTrigger value="code">Pairing code</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
          </TabsList>
          <TabsContent value="usb">
            <UsbForm />
          </TabsContent>
          <TabsContent value="code">
            <PairingForm />
          </TabsContent>
          <TabsContent value="webhook">
            <WebhookForm />
          </TabsContent>
        </Tabs>
      </RequireKey>
    </>
  )
}
