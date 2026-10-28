"use client";

import { useState } from "react";
import TeachersAdminPanel from "@/components/TeachersAdminPanel";
import { PageHeader, Panel, Tabs } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/AdminShell";

export default function TeachersPage() {
  const [tab, setTab] = useState<"teachers" | "codes">("teachers");
  const { isAdmin, actor } = useAdminData();
  return (
    <>
      <PageHeader
        title={isAdmin ? "معلم‌ها و کد معرف" : `معلم‌های ${actor.institutionName || "موسسه"}`}
        subtitle={
          isAdmin
            ? "فقط کسی که کد معرف داره می‌تونه حساب معلم یا مدیر بسازه. کد مدیر برای موسسه‌هاست؛ کد معلم می‌تونه مستقل باشه یا به یه موسسه وصل بشه."
            : "کد معرف معلم‌های موسسه‌ات رو خودت بساز و سقف کلاس و جلسه‌ی هرکدوم رو تعیین کن."
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "teachers", label: "معلم‌ها و سقف‌ها" },
          { id: "codes", label: "کدهای معرف" },
        ]}
      />
      <Panel>
        <TeachersAdminPanel section={tab} />
      </Panel>
    </>
  );
}
