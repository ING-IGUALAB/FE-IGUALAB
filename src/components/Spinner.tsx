import { ClipLoader } from "react-spinners";

// Envoltura de react-spinners para botones. Hereda el color del texto (currentColor).
export default function Spinner({ size = 18, className = "" }: Readonly<{ size?: number; className?: string }>) {
  return (
    <span className={`inline-flex ${className}`}>
      <ClipLoader size={size} color="currentColor" />
    </span>
  );
}
