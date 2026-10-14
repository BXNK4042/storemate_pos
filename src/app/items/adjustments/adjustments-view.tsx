"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Download,
  ArrowLeft,
  Calendar,
  RotateCcw,
  Loader2,
  ArrowRight,
  User,
  Hash,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  StockAdjustmentRecord,
  StockAdjustmentReason,
  StockAdjustmentListResult,
} from "@/types/stock";
import { StockReasonBadge, STOCK_REASON_CONFIG, getStockReasonLabel } from "@/components/inventory/stock-reason-badge";
import { parseDbDate, formatThaiDateTime, getLocalDateString } from "@/lib/date-utils";

type DatePreset = "all" | "today" | "7days" | "30days" | "custom";

export default function AdjustmentsView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StockAdjustmentListResult>({
    adjustments: [],
    pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
    metrics: { totalIn: 0, totalOut: 0, netChange: 0, recordCount: 0 },
  });

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reason, setReason] = useState<StockAdjustmentReason | "all">("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle Date presets
  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    setLoading(true);
    setPage(1);

    const now = new Date();

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const todayStr = getLocalDateString(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      setStartDate(getLocalDateString(sevenDaysAgo));
      setEndDate(getLocalDateString(now));
    } else if (preset === "30days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      setStartDate(getLocalDateString(thirtyDaysAgo));
      setEndDate(getLocalDateString(now));
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));

        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (reason !== "all") params.set("reason", reason);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/inventory/adjustments?${params.toString()}`);
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to load audit logs:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [page, limit, debouncedSearch, reason, startDate, endDate]);

  const handleResetFilters = () => {
    setLoading(true);
    setSearch("");
    setDebouncedSearch("");
    setReason("all");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Export visible data to CSV with UTF-8 BOM
  const handleExportCsv = () => {
    if (data.adjustments.length === 0) {
      alert("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }

    const headers = [
      "รหัสบันทึก",
      "วันที่-เวลา",
      "รหัสสินค้า",
      "ชื่อสินค้า",
      "บาร์โค้ด",
      "จำนวนที่ปรับ",
      "คงเหลือเดิม",
      "คงเหลือใหม่",
      "เหตุผล",
      "เลขอ้างอิง",
      "หมายเหตุ",
      "ผู้ดำเนินการ",
    ];

    const rows = data.adjustments.map((r) => [
      r.adjustment_id,
      `"${r.created_at}"`,
      r.item_id,
      `"${(r.item_name || "").replace(/"/g, '""')}"`,
      `"${r.item_barcode || ""}"`,
      r.change_qty,
      r.previous_qty,
      r.new_qty,
      `"${getStockReasonLabel(r.reason)}"`,
      `"${(r.reference_id || "").replace(/"/g, '""')}"`,
      `"${(r.note || "").replace(/"/g, '""')}"`,
      `"${r.user_name || ""}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stock-adjustments-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = parseDbDate(dateStr);
      return d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/items">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              title="กลับไปหน้ารายการสินค้า"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              สมุดบันทึกประวัติสต็อก
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Stock Adjustment Audit Logs • ตรวจสอบรายการเคลื่อนไหวสต็อกสินค้าทั้งหมด
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 h-9 text-xs cursor-pointer"
            disabled={data.adjustments.length === 0}
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>ส่งออก CSV</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <Card className="p-0 gap-0">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อสินค้า, บาร์โค้ด, เลขอ้างอิง, หรือหมายเหตุ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Reason Dropdown Filter */}
            <div className="w-full lg:w-60">
              <select
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value as StockAdjustmentReason | "all");
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                <option value="all">เหตุผลทั้งหมด (All Reasons)</option>
                <option value="restock">รับเข้าสินค้า</option>
                <option value="damage">สินค้าเสียหาย / ตัดสต็อก</option>
                <option value="inventory_count">ตรวจนับ / ปรับยอด</option>
              </select>
            </div>

            {/* Reset Button */}
            {(search || reason !== "all" || datePreset !== "all" || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>ล้างตัวกรอง</span>
              </Button>
            )}
          </div>

          {/* Date range filter buttons and picker */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium mr-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>ช่วงเวลา:</span>
            </div>

            <Button
              variant={datePreset === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => applyDatePreset("all")}
              className="h-8 text-xs cursor-pointer"
            >
              ทั้งหมด
            </Button>
            <Button
              variant={datePreset === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => applyDatePreset("today")}
              className="h-8 text-xs cursor-pointer"
            >
              วันนี้
            </Button>
            <Button
              variant={datePreset === "7days" ? "default" : "outline"}
              size="sm"
              onClick={() => applyDatePreset("7days")}
              className="h-8 text-xs cursor-pointer"
            >
              7 วันล่าสุด
            </Button>
            <Button
              variant={datePreset === "30days" ? "default" : "outline"}
              size="sm"
              onClick={() => applyDatePreset("30days")}
              className="h-8 text-xs cursor-pointer"
            >
              30 วันล่าสุด
            </Button>

            {/* Custom date range inputs */}
            <div className="flex items-center gap-1 ml-auto">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset("custom");
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs w-32"
              />
              <span className="text-muted-foreground text-xs">-</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset("custom");
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs w-32"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card className="overflow-hidden p-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[170px] pl-4">วันที่ / เวลา</TableHead>
                <TableHead className="min-w-[200px]">สินค้า</TableHead>
                <TableHead className="w-[160px]">ประเภท / เหตุผล</TableHead>
                <TableHead className="text-center w-[160px]">ก่อนหน้า → คงเหลือ</TableHead>
                <TableHead className="w-[220px]">อ้างอิง / หมายเหตุ</TableHead>
                <TableHead className="w-[130px] pr-4">ผู้ดำเนินการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>กำลังโหลดสมุดบันทึกสต็อก...</span>
                  </TableCell>
                </TableRow>
              ) : data.adjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                    <p className="text-sm font-medium">ไม่พบรายการบันทึกตามเงื่อนไขที่เลือก</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">
                      ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองช่วงเวลา
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                data.adjustments.map((record: StockAdjustmentRecord) => {
                  return (
                    <TableRow key={record.adjustment_id} className="hover:bg-muted/40">
                      {/* Date & Time */}
                      <TableCell className="pl-4 text-xs text-muted-foreground font-mono">
                        {formatDateTime(record.created_at)}
                      </TableCell>

                      {/* Item Details */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-foreground">
                            {record.item_name || `สินค้า #${record.item_id}`}
                          </span>
                          {record.item_barcode && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {record.item_barcode}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Reason Badge */}
                      <TableCell>
                        <StockReasonBadge reason={record.reason} />
                      </TableCell>

                      {/* Previous -> New */}
                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground bg-muted/60 border border-border/60 px-2.5 py-0.5 rounded-md">
                          <span>{record.previous_qty}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-bold text-foreground">{record.new_qty}</span>
                        </div>
                      </TableCell>

                      {/* Reference & Note */}
                      <TableCell>
                        <div className="space-y-1">
                          {record.reference_id && (
                            <div className="inline-flex items-center gap-1 font-mono text-[11px] bg-muted text-foreground border border-border px-1.5 py-0.5 rounded">
                              <Hash className="h-2.5 w-2.5" />
                              <span>{record.reference_id}</span>
                            </div>
                          )}
                          {record.note && (
                            <div className="text-xs text-gray-700 flex items-start gap-1">
                              <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="truncate max-w-[200px]" title={record.note}>
                                {record.note}
                              </span>
                            </div>
                          )}
                          {!record.reference_id && !record.note && (
                            <span className="text-xs text-muted-foreground/40">-</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Operator Username */}
                      <TableCell className="pr-4">
                        {record.user_name ? (
                          <div className="inline-flex items-center gap-1 text-xs text-foreground font-medium">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{record.user_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">ระบบ (System)</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination bar */}
          <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>
                แสดง {data.adjustments.length} จากทั้งหมด{" "}
                <strong className="text-foreground">{data.pagination.total}</strong> รายการ
              </span>

              <div className="flex items-center gap-1">
                <span>แถวต่อหน้า:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs cursor-pointer"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono">
                หน้า {data.pagination.page} / {data.pagination.totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.pagination.page <= 1 || loading}
                  className="h-8 w-8 p-0 cursor-pointer"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={data.pagination.page >= data.pagination.totalPages || loading}
                  className="h-8 w-8 p-0 cursor-pointer"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
