import { useMemo, useState } from "react";
import { Tags, Plus, ChevronRight, Trash2 } from "lucide-react";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import { getCategoryIcon, CATEGORY_ICON_OPTIONS } from "../../constants/categoryIcons";
import SettingsCard from "./SettingsCard";
import Modal from "../ui/Modal";
import ConfirmDialog from "../ui/ConfirmDialog";
import FormField from "../ui/FormField";
import { inputClass } from "../ui/formStyles";
import type { Category } from "../../types/finance";

const COLORS = ["#0f6466", "#059669", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

export default function CategoriesCard() {
  const { transactions, categories, addCategory, updateCategory, deleteCategory } = useFinanceData();
  const { show } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<Category["type"]>("expense");
  const [icon, setIcon] = useState(CATEGORY_ICON_OPTIONS[0]);
  const [color, setColor] = useState(COLORS[0]);

  const usageCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + 1);
    return map;
  }, [transactions]);

  function openCreate() {
    setEditing(null);
    setName("");
    setType("expense");
    setIcon(CATEGORY_ICON_OPTIONS[0]);
    setColor(COLORS[0]);
    setModalOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setName(category.name);
    setType(category.type);
    setIcon(category.icon);
    setColor(category.color);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (editing) {
      await updateCategory(editing.id, { name, type, icon, color });
      show("Categoria atualizada.");
    } else {
      await addCategory({ name, type, icon, color });
      show("Categoria criada.");
    }
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    await deleteCategory(pendingDelete.id);
    show("Categoria excluída.");
    setPendingDelete(null);
  }

  return (
    <SettingsCard icon={Tags} title="Categorias" description="Gerencie suas categorias de despesas">
      <ul className="divide-y divide-ink-100">
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.icon);
          return (
            <li key={category.id} className="flex items-center justify-between py-2.5">
              <button onClick={() => openEdit(category)} className="flex flex-1 items-center gap-3 text-left">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${category.color}20`, color: category.color }}>
                  <Icon size={15} />
                </span>
                <span className="text-sm font-medium text-ink-900">{category.name}</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">{usageCount.get(category.id) ?? 0} transações</span>
                {!category.isDefault && (
                  <button aria-label="Excluir categoria" onClick={() => setPendingDelete(category)} className="rounded-lg p-1.5 text-ink-300 hover:bg-danger-500/10 hover:text-danger-600">
                    <Trash2 size={14} />
                  </button>
                )}
                <ChevronRight size={14} className="text-ink-300" />
              </div>
            </li>
          );
        })}
      </ul>

      <button onClick={openCreate} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-200 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-50">
        <Plus size={15} /> Adicionar categoria
      </button>

      <Modal
        open={modalOpen}
        title={editing ? "Editar categoria" : "Nova categoria"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">Cancelar</button>
            <button onClick={handleSave} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Salvar</button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Nome" htmlFor="category-name">
            <input id="category-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Tipo" htmlFor="category-type">
            <select id="category-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as Category["type"])}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
              <option value="both">Ambos</option>
            </select>
          </FormField>
          <FormField label="Ícone">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICON_OPTIONS.map((option) => {
                const Icon = getCategoryIcon(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setIcon(option)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${icon === option ? "bg-brand-100 ring-2 ring-brand-500" : "bg-ink-50"}`}
                  >
                    <Icon size={15} />
                  </button>
                );
              })}
            </div>
          </FormField>
          <FormField label="Cor">
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`h-8 w-8 rounded-full ${color === c ? "ring-2 ring-ink-700 ring-offset-2" : ""}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir categoria"
        message={`Tem certeza que deseja excluir "${pendingDelete?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </SettingsCard>
  );
}
