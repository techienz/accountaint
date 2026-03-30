import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listHolidayAttachments, createHolidayAttachment, deleteHolidayAttachment } from "@/lib/budget";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { v4 as uuid } from "uuid";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json(listHolidayAttachments(id, session.user.id));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: holidayId } = await params;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    // File upload
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || file?.name || "Attachment";

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dir = join(process.cwd(), "data", "holiday-attachments", holidayId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const ext = file.name.split(".").pop() || "bin";
    const filename = `${uuid()}.${ext}`;
    writeFileSync(join(dir, filename), buffer);

    const attachment = createHolidayAttachment(session.user.id, {
      holiday_id: holidayId,
      name,
      type: "file",
      file_path: `holiday-attachments/${holidayId}/${filename}`,
    });
    return NextResponse.json(attachment, { status: 201 });
  }

  // JSON — link
  const body = await request.json();
  if (!body.name || !body.url) {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  }

  const attachment = createHolidayAttachment(session.user.id, {
    holiday_id: holidayId,
    name: body.name,
    type: "link",
    url: body.url,
  });
  return NextResponse.json(attachment, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.attachment_id) {
    return NextResponse.json({ error: "attachment_id required" }, { status: 400 });
  }

  const deleted = deleteHolidayAttachment(body.attachment_id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
