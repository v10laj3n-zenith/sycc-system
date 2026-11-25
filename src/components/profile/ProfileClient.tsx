"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Lock, Receipt, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { compressImageToWebp } from "@/lib/image-compress";
import { formatManilaDate, formatPhp } from "@/lib/format";
import { getHierarchyStyle } from "@/lib/hierarchy-styles";
import {
  updateAvatarUrlAction,
  updateOwnProfileAction,
} from "@/actions/profile";
import { PushSetupCard } from "@/components/pwa/PushSetupCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProfileRow, TitheOfferingRow } from "@/types/database.types";

export function ProfileClient({
  profile,
  givingHistory,
}: {
  profile: ProfileRow;
  givingHistory: TitheOfferingRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [fullName, setFullName] = useState(profile.full_name);
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [birthday, setBirthday] = useState(profile.birthday ?? "");
  const [ministryTeam, setMinistryTeam] = useState(profile.ministry_team ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  const hierarchy = getHierarchyStyle(profile.tier, profile.current_leader_id);
  const totalGiven = givingHistory.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  );

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setUploadingAvatar(true);
    try {
      // Mandatory client-side WebP compression (<= 30 KB, 400px max)
      const compressedWebp = await compressImageToWebp(rawFile);
      const supabase = createClient();
      const filePath = `${profile.id}/avatar-${Date.now()}.webp`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressedWebp, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadErr) {
        toast.error(uploadErr.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const saveRes = await updateAvatarUrlAction(publicUrl);
      if (!saveRes.success) {
        toast.error(saveRes.error ?? "Failed to update avatar URL.");
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success(
        `Profile photo updated (${Math.round(compressedWebp.size / 1024)} KB WebP)!`
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Image compression failed."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateOwnProfileAction({
        full_name: fullName,
        nickname,
        phone,
        birthday: birthday || null,
        ministry_team: ministryTeam,
        bio,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to save profile.");
        return;
      }
      toast.success("Profile updated!");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Avatar & Identity Card */}
      <Card>
        <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20 border-2 border-slate-200">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
              <AvatarFallback className="text-lg">
                {fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-md hover:opacity-95"
              title="Upload photo (auto-compressed <= 30 KB WebP)"
            >
              <Camera className="h-4 w-4" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploadingAvatar}
                onChange={handleAvatarChange}
              />
            </label>
          </div>

          <div className="text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">
                {profile.full_name}
              </h1>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs",
                  hierarchy.badgeClass
                )}
              >
                {hierarchy.label}
              </span>
            </div>
            <p className="text-xs text-slate-500">{profile.email}</p>
            <p className="text-[11px] text-slate-400">
              {uploadingAvatar
                ? "Compressing to <= 30 KB WebP & uploading..."
                : "Photos are auto-optimized to <= 30 KB WebP to keep SYCC 100% free."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Editable Bio Form */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Profile &amp; Bio</CardTitle>
          <CardDescription>
            Keep your contact and ministry details updated for your Cell Leader.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prof-fullname">Full Name</Label>
                <Input
                  id="prof-fullname"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-nick">Nickname</Label>
                <Input
                  id="prof-nick"
                  placeholder="How friends call you"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-phone">Mobile Number</Label>
                <Input
                  id="prof-phone"
                  placeholder="09XX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-bday">Birthday</Label>
                <Input
                  id="prof-bday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-ministry">Ministry Team</Label>
              <Input
                id="prof-ministry"
                placeholder="e.g., Worship, Media, Ushering, Hospitality"
                value={ministryTeam}
                onChange={(e) => setMinistryTeam(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-bio">Short Bio / Life Verse</Label>
              <Textarea
                id="prof-bio"
                placeholder="Share your favorite verse or testimony..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={isPending}>
              <Save className="h-4 w-4" />
              {isPending ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* PWA Push Setup */}
      <PushSetupCard />

      {/* Private Giving History (Strictly RLS-scoped to self) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[var(--color-accent)]" />
                My Private Giving History
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <Lock className="h-3.5 w-3.5" />
                Visible strictly to you and SYCC Treasury (hidden from Cell
                Leaders &amp; Pastor).
              </CardDescription>
            </div>
            <Badge variant="success">YTD: {formatPhp(totalGiven)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {givingHistory.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No personal giving records yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {givingHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold capitalize text-slate-900">
                      {item.giving_type}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatManilaDate(item.service_date)} ·{" "}
                      {item.payment_method === "gcash_ewallet"
                        ? "GCash / E-Wallet"
                        : "Cash"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-slate-900">
                      {formatPhp(item.amount)}
                    </p>
                    {item.receipt_sent_at && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Receipt Sent
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
