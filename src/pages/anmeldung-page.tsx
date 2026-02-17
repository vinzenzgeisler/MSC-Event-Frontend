import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { config } from "@/app/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const registrationSchema = z.object({
  classId: z.string().min(1, "Klasse ist erforderlich"),
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  email: z.string().email("Ungültige E-Mail"),
  vehicleType: z.enum(["auto", "moto"]),
  startNumber: z.string().optional()
});

type RegistrationValues = z.infer<typeof registrationSchema>;

export function AnmeldungPage() {
  const form = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      classId: "",
      firstName: "",
      lastName: "",
      email: "",
      vehicleType: "auto",
      startNumber: ""
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anmeldung (MVP-Form)</CardTitle>
        <CardDescription>
          Dieses Formular ist vorbereitet, bleibt aber bis zur neuen OpenAPI für Read-Endpoints/Responses eingeschränkt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Backend-Lücke: Public Event/Klassen Read Endpoint fehlt</Badge>
          <Badge variant="outline">VITE_PUBLIC_EVENT_ID: {config.publicEventId || "nicht gesetzt"}</Badge>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(() => undefined)}>
          <div className="space-y-2">
            <Label htmlFor="classId">Klassen-ID</Label>
            <Input id="classId" {...form.register("classId")} />
            <p className="text-xs text-muted-foreground">Temporär manuell, bis öffentliche Klassenliste verfügbar ist.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleType">Fahrzeugtyp (auto/moto)</Label>
            <Input id="vehicleType" {...form.register("vehicleType")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="firstName">Vorname</Label>
            <Input id="firstName" {...form.register("firstName")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Nachname</Label>
            <Input id="lastName" {...form.register("lastName")} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" {...form.register("email")} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="startNumber">Startnummer</Label>
            <Input id="startNumber" {...form.register("startNumber")} />
          </div>

          <div className="md:col-span-2">
            <Button type="submit" className="w-full" disabled>
              Submit (aktiv nach OpenAPI-Upgrade)
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
