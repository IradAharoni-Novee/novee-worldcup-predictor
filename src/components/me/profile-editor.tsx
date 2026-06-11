"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ImageUp, KeyRound, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { veeveeToast } from "@/components/ui/veevee-toast";
import { DISPLAY_NAME_MAX } from "@/lib/profile";
import { validateAvatarUpload } from "@/lib/avatar";
import {
  removeAvatar,
  updateProfile,
  type ProfileResult,
} from "@/lib/actions/profile";

export function ProfileEditor({
  email,
  name,
  image,
  uploadsEnabled,
}: {
  email: string;
  name: string | null;
  image: string | null;
  uploadsEnabled: boolean;
}) {
  const [currentImage, setCurrentImage] = useState(image);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [nameState, saveName, savingName] = useActionState<
    ProfileResult | null,
    FormData
  >(updateProfile, null);

  useEffect(() => {
    if (nameState?.ok) veeveeToast("Profile updated.");
  }, [nameState]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateAvatarUpload({ type: file.type, size: file.size });
    if (!check.ok) {
      toast.error(check.error);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/me/avatar", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Upload failed.");
        return;
      }
      setCurrentImage(data.url);
      veeveeToast("New photo saved.");
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemove() {
    setRemoving(true);
    try {
      const res = await removeAvatar();
      if (res.ok) {
        setCurrentImage(null);
        veeveeToast("Photo removed.");
      } else {
        toast.error(res.error);
      }
    } finally {
      setRemoving(false);
    }
  }

  const busy = uploading || removing;

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <Card className="px-4 sm:px-6 py-5 gap-5">
        <div className="flex items-center gap-4">
          <UserAvatar
            email={email}
            name={name}
            image={currentImage}
            size={72}
            className="rounded-xl"
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!uploadsEnabled || busy}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImageUp className="size-4" />
                )}
                {currentImage ? "Change photo" : "Upload photo"}
              </Button>
              {currentImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={onRemove}
                >
                  {removing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Remove
                </Button>
              )}
            </div>
            <p className="body body-size-xsmall text-[color:var(--color-text-tertiary)]">
              {uploadsEnabled
                ? "JPEG, PNG, or WebP · up to 4 MB. We crop to a square."
                : "Photo uploads aren't configured on this deployment."}
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        <form action={saveName} className="flex flex-col gap-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={name ?? ""}
            maxLength={DISPLAY_NAME_MAX}
            placeholder={email.split("@")[0]}
            size="lg"
          />
          {nameState && !nameState.ok && (
            <p className="body body-size-small text-[color:var(--color-accent-danger)]">
              {nameState.error}
            </p>
          )}
          <Button type="submit" className="mt-2 self-start" disabled={savingName}>
            {savingName ? "Saving…" : "Save name"}
          </Button>
        </form>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} readOnly size="lg" />
        </div>
      </Card>

      <Card className="px-4 sm:px-6 py-4 flex-row items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="body body-weight-medium body-size-medium">Password</span>
          <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
            Set or change the password you sign in with.
          </span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/set-password">
            <KeyRound className="size-4" /> Reset password
          </Link>
        </Button>
      </Card>
    </div>
  );
}
