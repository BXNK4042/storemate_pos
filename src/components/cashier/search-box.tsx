import { Input } from "@/components/ui/input"

interface SearchInputProps {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = "ค้นหาสินค้า" }: SearchInputProps) {
  return <Input value={value} onChange={onChange} placeholder={placeholder} />
}
