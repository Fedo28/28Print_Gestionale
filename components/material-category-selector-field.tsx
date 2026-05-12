"use client";

import { useEffect, useState } from "react";
import { orderMaterialCategoryOptions } from "@/lib/constants";
import {
  createEmptyOrderMaterialCategoryCounts,
  type OrderMaterialCategoryCounts,
  type OrderMaterialCategoryKey
} from "@/lib/order-material-note";

type MaterialCategorySelectorFieldProps = {
  defaultValue?: OrderMaterialCategoryCounts;
  idPrefix: string;
  inputNamePrefix?: string;
  label?: string;
  onChange?: (value: OrderMaterialCategoryCounts) => void;
  value?: OrderMaterialCategoryCounts;
};

export function MaterialCategorySelectorField({
  defaultValue,
  idPrefix,
  inputNamePrefix,
  label = "Categorie",
  onChange,
  value
}: MaterialCategorySelectorFieldProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<OrderMaterialCategoryCounts>(() => defaultValue ?? createEmptyOrderMaterialCategoryCounts());
  const [pickerValue, setPickerValue] = useState<OrderMaterialCategoryKey | "">("");
  const counts = isControlled ? value : internalValue;
  const selectedCategories = orderMaterialCategoryOptions.filter(({ key }) => counts[key].trim() !== "");
  const availableCategories = orderMaterialCategoryOptions.filter(({ key }) => counts[key].trim() === "");

  useEffect(() => {
    if (pickerValue && availableCategories.some(({ key }) => key === pickerValue)) {
      return;
    }

    setPickerValue(availableCategories[0]?.key ?? "");
  }, [availableCategories, pickerValue]);

  function commit(nextValue: OrderMaterialCategoryCounts) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue);
  }

  function addCategory() {
    if (!pickerValue) {
      return;
    }

    commit({
      ...counts,
      [pickerValue]: counts[pickerValue].trim() || "1"
    });
  }

  function removeCategory(key: OrderMaterialCategoryKey) {
    commit({
      ...counts,
      [key]: ""
    });
  }

  function updateCount(key: OrderMaterialCategoryKey, rawValue: string) {
    commit({
      ...counts,
      [key]: rawValue.replace(/[^\d]/g, "")
    });
  }

  return (
    <div className="field full order-material-categories-field">
      <label htmlFor={`${idPrefix}-category-picker`}>{label}</label>
      <div className="order-material-category-picker">
        <select
          disabled={availableCategories.length === 0}
          id={`${idPrefix}-category-picker`}
          onChange={(event) => setPickerValue(event.target.value as OrderMaterialCategoryKey | "")}
          value={pickerValue}
        >
          {availableCategories.length === 0 ? (
            <option value="">Tutte aggiunte</option>
          ) : null}
          {availableCategories.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          className="secondary order-material-category-add"
          disabled={!pickerValue}
          onClick={addCategory}
          type="button"
        >
          Aggiungi
        </button>
      </div>

      {selectedCategories.length > 0 ? (
        <div className="order-material-category-list">
          {selectedCategories.map(({ key, label: categoryLabel }) => (
            <div className="order-material-category-row" key={key}>
              <label htmlFor={`${idPrefix}-${key}`}>{categoryLabel}</label>
              <input
                id={`${idPrefix}-${key}`}
                inputMode="numeric"
                min="0"
                name={inputNamePrefix ? `${inputNamePrefix}-${key}` : undefined}
                onChange={(event) => updateCount(key, event.target.value)}
                step="1"
                type="number"
                value={counts[key]}
              />
              <button
                aria-label={`Rimuovi ${categoryLabel}`}
                className="ghost order-material-category-remove"
                onClick={() => removeCategory(key)}
                type="button"
              >
                Rimuovi
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
