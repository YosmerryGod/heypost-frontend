import { useEffect, useRef, useState } from "react";
import { CameraOff, LoaderCircle, RotateCcw, ScanLine } from "lucide-react";
import "./EmployeeBarcodeScanner.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EmployeeBarcodeScannerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
};

type ScannerStatus = "starting" | "scanning" | "error";
type ScannerControls = { stop: () => void };

const employeeBarcodePattern = /^HP-[A-Za-z0-9_-]{32}$/;

function unsupportedCameraMessage() {
  return !window.isSecureContext || !navigator.mediaDevices?.getUserMedia
    ? "Pemindaian kamera memerlukan HTTPS dan browser yang mendukung kamera. Silakan masukkan barcode secara manual."
    : "";
}

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Izin kamera belum diberikan. Izinkan kamera melalui pengaturan situs browser, lalu coba lagi. Anda juga dapat menempel barcode secara manual.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Kamera tidak ditemukan pada perangkat ini. Silakan masukkan barcode secara manual.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "Kamera tidak dapat dibuka, mungkin sedang dipakai aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.";
  }
  return "Kamera tidak dapat dimulai. Periksa izin browser atau masukkan barcode secara manual.";
}

export function EmployeeBarcodeScanner({ open, onOpenChange, onScan }: EmployeeBarcodeScannerProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const onScanRef = useRef(onScan);
  const [status, setStatus] = useState<ScannerStatus>(() => unsupportedCameraMessage() ? "error" : "starting");
  const [errorMessage, setErrorMessage] = useState(unsupportedCameraMessage);
  const [invalidMessage, setInvalidMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!open || !video) return;

    let active = true;
    let completed = false;
    let controls: ScannerControls | undefined;
    let lastInvalidCode = "";

    const stopCamera = () => {
      controls?.stop();
      const stream = video?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };

    if (unsupportedCameraMessage()) return;

    const start = async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (!active || !video) return;

        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 500,
        });
        const nextControls = await reader.decodeFromConstraints({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        }, video, (result) => {
          if (!result || completed || !active) return;

          const barcode = result.getText().trim();
          if (!employeeBarcodePattern.test(barcode)) {
            if (barcode !== lastInvalidCode) {
              lastInvalidCode = barcode;
              setInvalidMessage("QR ini bukan kartu akses karyawan HeyPost. Bidik QR yang dibuat dari menu Karyawan.");
            }
            return;
          }

          completed = true;
          stopCamera();
          onScanRef.current(barcode);
          onOpenChange(false);
        });

        controls = nextControls;
        if (!active || completed) {
          controls.stop();
          return;
        }
        setStatus("scanning");
      } catch (error) {
        stopCamera();
        if (!active || completed) return;
        setStatus("error");
        setErrorMessage(cameraErrorMessage(error));
      }
    };

    void start();
    return () => {
      active = false;
      stopCamera();
    };
  }, [open, attempt, onOpenChange, video]);

  const retry = () => {
    const unsupportedMessage = unsupportedCameraMessage();
    setStatus(unsupportedMessage ? "error" : "starting");
    setErrorMessage(unsupportedMessage);
    setInvalidMessage("");
    if (!unsupportedMessage) setAttempt((value) => value + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scanner-dialog" aria-describedby="scanner-description">
        <DialogHeader>
          <DialogTitle>Pindai kartu karyawan</DialogTitle>
          <DialogDescription id="scanner-description">
            Arahkan kamera ke QR dari owner. Barcode akan terisi otomatis, lalu Anda tetap perlu memasukkan PIN.
          </DialogDescription>
        </DialogHeader>

        <div className={`scanner-stage ${status === "scanning" ? "is-ready" : ""}`}>
          <video ref={setVideo} autoPlay playsInline muted aria-label="Pratinjau kamera pemindai QR" />
          {status === "scanning" && <div className="scanner-frame" aria-hidden="true"><i /><i /><i /><i /></div>}
          {status === "starting" && <div className="scanner-state" role="status">
            <LoaderCircle className="spin" size={28} />
            <strong>Menyiapkan kamera…</strong>
            <span>Izinkan akses kamera jika browser memintanya.</span>
          </div>}
          {status === "error" && <div className="scanner-state scanner-error" role="alert">
            <CameraOff size={30} />
            <strong>Kamera belum dapat digunakan</strong>
            <span>{errorMessage}</span>
          </div>}
        </div>

        <div className="scanner-guidance">
          {status === "error" ? (
            unsupportedCameraMessage() ? null : <button className="button secondary full-width" type="button" onClick={retry}>
              <RotateCcw size={17} /> Coba buka kamera lagi
            </button>
          ) : (
            <p className={invalidMessage ? "scanner-invalid" : ""} role={invalidMessage ? "alert" : "status"} aria-live="polite">
              <ScanLine size={18} aria-hidden="true" />
              <span>{invalidMessage || (status === "scanning" ? "Posisikan seluruh QR di dalam bingkai dan tahan perangkat tetap stabil." : "Video hanya diproses di perangkat ini dan tidak dikirim ke server.")}</span>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
