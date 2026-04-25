import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Users } from "lucide-react";

const sizes = [1, 2, 3, 4, 5, 6];
const zones = ["Binnen", "Terras", "Bar", "Serre"];

const WalkInsPage = () => {
  const [size, setSize] = useState<number | null>(null);
  const [zone, setZone] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl">Walk-ins</h1>
        <p className="text-muted-foreground">Spontane gast aan de deur? Drie tikken en geplaatst.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stap 1 — Aantal personen</CardTitle>
          <CardDescription>Tik op het juiste aantal</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {sizes.map((n) => (
            <Button
              key={n}
              variant={size === n ? "default" : "outline"}
              className="h-16 text-2xl font-display"
              onClick={() => setSize(n)}
            >
              {n === 6 ? "6+" : n}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stap 2 — Zone</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {zones.map((z) => (
            <Button
              key={z}
              variant={zone === z ? "default" : "outline"}
              className="h-14"
              onClick={() => setZone(z)}
            >
              {z}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stap 3 — Plaatsen</CardTitle>
          <CardDescription>
            {size && zone ? `${size} ${size === 1 ? "persoon" : "personen"} op ${zone.toLowerCase()}` : "Kies eerst aantal en zone"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="h-14 w-full text-lg" disabled={!size || !zone}>
            <Users className="mr-2 h-5 w-5" /> Plaats nu
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> AI Quick Seat
            </CardTitle>
            <Badge variant="secondary">Binnenkort</Badge>
          </div>
          <CardDescription>Beschrijf in één zin, AI stelt een tafel voor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input placeholder="Bijv. 2 personen op terras nu" disabled className="h-12" />
        </CardContent>
      </Card>
    </div>
  );
};

export default WalkInsPage;
