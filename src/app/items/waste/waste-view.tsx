"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Trash2,
  User,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import type {
  WasteRecord,
  WasteReason,
  WasteListResult,
} from "@/types/waste";
import { WasteReasonBadge, WASTE_REASON_CONFIG } from "@/components/inventory/waste-reason-badge";
import { WasteKpiSummary } from "@/components/inventory/waste-kpi-summary";
import { WasteLogDialog } from "@/components/inventory/waste-log-dialog";

type DatePreset = "all" | "today" | "7days" | "30days" | "custom";

export default function WasteView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WasteListResult>({
    records: [],
    pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
    metrics: {
      totalIncidents: 0,
      totalQuantity: 0,
      totalLossAmount: 0,
      byReason: {
        damaged: { reason: "damaged", count: 0, quantity: 0, lossAmount: 0 },
        spoiled: { reason: "spoiled", count: 0, quantity: 0, lossAmount: 0 },
        expired: { reason: "expired", count: 0, quantity: 0, lossAmount: 0 },
        discarded: { reason: "discarded", count: 0, quantity: 0, lossAmount: 0 },
        other: { reason: "other", count: 0, quantity: 0, lossAmount: 0 },
      },
      topItems: [],
    },
  });

  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reason, setReason] = useState<WasteReason | "all">("all");
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
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const todayStr = formatDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      setStartDate(formatDate(sevenDaysAgo));
      setEndDate(formatDate(now));
    } else if (preset === "30days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      setStartDate(formatDate(thirtyDaysAgo));
      setEndDate(formatDate(now));
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (reason !== "all") params.set("reason", reason);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/waste?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load waste records:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, reason, startDate, endDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleResetFilters = () => {
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
    if (data.records.length === 0) {
      alert("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }

    const headers = [
      "รหัสบันทึกของเสีย",
      "วันที่-เวลา",
      "รหัสสินค้า",
      "ชื่อสินค้า",
      "บาร์โค้ด",
      "สาเหตุ",
      "จำนวนที่ตัด (ชิ้น)",
      "ต้นทุนต่อหน่วย (฿)",
      "มูลค่าความเสียหาย (฿)",
      "ผู้บันทึก",
      "หมายเหตุ",
    ];

    const rows = data.records.map((r) => [
      r.waste_id,
      `"${r.created_at}"`,
      r.item_id,
      `"${(r.item_name || "").replace(/"/g, '""')}"`,
      `"${r.item_barcode || ""}"`,
      `"${WASTE_REASON_CONFIG[r.reason]?.label || r.reason}"`,
      r.quantity,
      r.unit_cost,
      r.total_cost,
      `"${r.user_name || ""}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `waste-records-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
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
              จัดการและบันทึกของเสีย
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ติดตามสินค้าชำรุด เน่าเสีย และหมดอายุ พร้อมตรวจสอบมูลค่าความเสียหาย
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={loading || data.records.length === 0}
            className="gap-2 cursor-pointer"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            <span>ส่งออก CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsLogDialogOpen(true)}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>บันทึกของเสีย</span>
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <WasteKpiSummary metrics={data.metrics} />

      {/* Filter Toolbar */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Box */}
            <div className="md:col-span-5 relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อสินค้า, รหัสบาร์โค้ด, หมายเหตุ หรือ ผู้บันทึก..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Reason Selector */}
            <div className="md:col-span-3">
              <select
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value as WasteReason | "all");
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                <option value="all">สาเหตุทั้งหมด</option>
                {(Object.keys(WASTE_REASON_CONFIG) as WasteReason[]).map((r) => (
                  <option key={r} value={r}>
                    {WASTE_REASON_CONFIG[r].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Date Presets */}
            <div className="md:col-span-4 flex items-center gap-1 overflow-x-auto">
              {(
                [
                  { id: "all", label: "ทั้งหมด" },
                  { id: "today", label: "วันนี้" },
                  { id: "7days", label: "7 วันล่าสุด" },
                  { id: "30days", label: "30 วันล่าสุด" },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyDatePreset(preset.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer shrink-0 ${
                    datePreset === preset.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range pickers & Reset */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">ช่วงวันที่:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                  setPage(1);
                }}
                className="h-8 w-34 text-xs font-mono"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                  setPage(1);
                }}
                className="h-8 w-34 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              {(search || reason !== "all" || startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  ล้างตัวกรอง
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData()}
                disabled={loading}
                className="h-8 text-xs cursor-pointer gap-1"
              >
                <RotateCcw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                รีเฟรช
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Waste Records Table */}
      <Card className="overflow-hidden p-0 gap-0 border shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[170px]">วันที่-เวลา</TableHead>
                <TableHead>สินค้า / บาร์โค้ด</TableHead>
                <TableHead className="w-[150px]">สาเหตุ</TableHead>
                <TableHead className="text-right w-[110px]">จำนวนที่ตัด</TableHead>
                <TableHead className="text-right w-[120px]">ต้นทุน/หน่วย (฿)</TableHead>
                <TableHead className="text-right w-[140px]">มูลค่าเสียหายรวม (฿)</TableHead>
                <TableHead className="w-[120px]">ผู้บันทึก</TableHead>
                <TableHead className="w-[200px]">หมายเหตุ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-rose-600" />
                    กำลังโหลดข้อมูลของเสีย...
                  </TableCell>
                </TableRow>
              ) : data.records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Trash2 className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-gray-700">ไม่พบรายการของเสีย</p>
                      <p className="text-xs text-muted-foreground">
                        {search || reason !== "all" || startDate || endDate
                          ? "ลองปรับเปลี่ยนเงื่อนไขการค้นหาหรือช่วงเวลา"
                          : "ยังไม่มีประวัติการบันทึกของเสียในระบบ"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.records.map((r: WasteRecord) => (
                  <TableRow key={r.waste_id} className="hover:bg-muted/30">
                    {/* Timestamp */}
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </TableCell>

                    {/* Item Name & Barcode */}
                    <TableCell>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {r.item_name || `สินค้า #${r.item_id}`}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {r.item_barcode || "-"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Reason */}
                    <TableCell>
                      <WasteReasonBadge reason={r.reason} />
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="text-right">
                      <span className="font-mono font-bold text-sm text-rose-600">
                        -{r.quantity.toLocaleString()}
                      </span>{" "}
                      <span className="text-[11px] text-muted-foreground">ชิ้น</span>
                    </TableCell>

                    {/* Unit Cost */}
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      ฿{r.unit_cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>

                    {/* Total Cost */}
                    <TableCell className="text-right font-mono font-bold text-sm text-rose-700">
                      ฿{r.total_cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>

                    {/* Logged by */}
                    <TableCell className="text-xs text-gray-700">
                      {r.user_name ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{r.user_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Notes */}
                    <TableCell className="text-xs text-muted-foreground">
                      {r.notes ? (
                        <div className="flex items-start gap-1">
                          <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="truncate max-w-[180px]" title={r.notes}>
                            {r.notes}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination Footer */}
        {data.pagination.total > 0 && (
          <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs bg-muted/20">
            <div className="text-muted-foreground">
              แสดงหน้า <span className="font-bold text-foreground">{data.pagination.page}</span> จาก{" "}
              <span className="font-bold text-foreground">{data.pagination.totalPages}</span> (ทั้งหมด{" "}
              <span className="font-bold text-foreground">{data.pagination.total}</span> รายการ)
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">แสดง:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs focus-visible:outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-muted-foreground">รายการ/หน้า</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="h-8 px-2 text-xs cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  ก่อนหน้า
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page >= data.pagination.totalPages || loading}
                  className="h-8 px-2 text-xs cursor-pointer"
                >
                  ถัดไป
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Log Waste Dialog */}
      <WasteLogDialog
        open={isLogDialogOpen}
        onOpenChange={setIsLogDialogOpen}
        onSuccess={() => {
          void loadData();
        }}
      />
    </div>
  );
}
