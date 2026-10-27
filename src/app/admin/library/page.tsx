"use client";

import LibraryAdminPanel from "@/components/LibraryAdminPanel";
import { PageHeader, Panel } from "@/components/admin/ui";

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="کتابخانه‌ی تمرین" subtitle="ویرایش و حذف تمرین‌های کتابخانه‌ی مشترک فقط از همین‌جا ممکنه؛ معلم‌ها فقط می‌تونن اضافه کنن و ازش استفاده کنن." />
      <Panel>
        <LibraryAdminPanel />
      </Panel>
    </>
  );
}
