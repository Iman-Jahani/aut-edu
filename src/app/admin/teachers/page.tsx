"use client";

import { useState } from "react";
import TeachersAdminPanel from "@/components/TeachersAdminPanel";
import { PageHeader, Panel, Tabs } from "@/components/admin/ui";

export default function TeachersPage() {
  const [tab, setTab] = useState<"teachers" | "codes">("teachers");
  return (
    <>
      <PageHeader
        title="معلم‌ها و کد معرف"
        subtitle="فقط کسی که کد معرف داره می‌تونه حساب معلم بسازه. سقف کلاس و جلسه‌ی هر معلم رو از همین‌جا تعیین کن."
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
