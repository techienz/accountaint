import type { XeroReport } from "@/lib/xero/types";
import { parseReportSections } from "@/lib/reports/parsers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type XeroReportTableProps = {
  report: XeroReport;
};

export function XeroReportTable({ report }: XeroReportTableProps) {
  const { headers, sections } = parseReportSections(report);

  return (
    <Table>
      {headers.length > 0 && (
        <TableHeader>
          <TableRow>
            {headers.map((h, i) => (
              <TableHead key={i} className={i > 0 ? "text-right" : ""}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {sections.map((section, si) => (
          <>
            {section.title && (
              <TableRow key={`title-${si}`}>
                <TableCell
                  colSpan={headers.length || 1}
                  className="font-semibold bg-muted/50 pt-4"
                >
                  {section.title}
                </TableCell>
              </TableRow>
            )}
            {section.rows.map((row, ri) => (
              <TableRow key={`row-${si}-${ri}`}>
                <TableCell className="pl-6">{row.label}</TableCell>
                {row.values.map((v, vi) => (
                  <TableCell key={vi} className="text-right">
                    {v}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {section.summaryRow && (
              <TableRow key={`summary-${si}`} className="font-semibold border-t">
                <TableCell className="pl-6">
                  {section.summaryRow.label}
                </TableCell>
                {section.summaryRow.values.map((v, vi) => (
                  <TableCell key={vi} className="text-right">
                    {v}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </>
        ))}
      </TableBody>
    </Table>
  );
}
