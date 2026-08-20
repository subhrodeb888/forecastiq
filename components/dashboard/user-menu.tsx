import { signOut } from "@/auth";
import Image from "next/image";

interface UserMenuProps {
  name: string;
  email: string;
  image?: string | null;
}

export default function UserMenu({ name, email, image }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      {image ? (
        <Image
          src={image}
          alt={name}
          width={40}
          height={40}
          className="rounded-full"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
          {name.charAt(0)}
        </div>
      )}

      <div className="hidden md:block">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-slate-500">{email}</p>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({
            redirectTo: "/login",
          });
        }}
      >
        <button className="ml-4 rounded-lg border px-3 py-2 text-sm hover:bg-slate-100">
          Sign Out
        </button>
      </form>
    </div>
  );
}
