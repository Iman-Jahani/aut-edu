"use client";

import LibraryAdminPanel from "@/components/LibraryAdminPanel";
import { PageHeader, Panel } from "@/components/admin/ui";
import { AdminOnly } from "@/components/admin/AdminShell";

export default function LibraryPage() {
  return (
    <AdminOnly>
      <PageHeader title="کتابخانه‌ی تمرین" subtitle="ویرایش و حذف تمرین‌های کتابخانه‌ی مشترک فقط از همین‌جا ممکنه؛ معلم‌ها فقط می‌تونن اضافه کنن و ازش استفاده کنن." />
      <Panel>
        <LibraryAdminPanel />
      </Panel>
    </AdminOnly>
  );
}
