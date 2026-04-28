import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { UNIT_PRESETS } from '../../services/laborEngine'

const CUSTOM_VALUE = '__custom__'

/**
 * Smart unit field.
 * Shows preset options (per use, per day, per week, per month)
 * plus a "Custom…" option that reveals a free-type input.
 *
 * Props:
 *   value        - current unit string
 *   onChange     - (unit, billing_type) => void
 *   placeholder  - placeholder for custom input
 *   disabled     - disables the field
 */
export default function UnitComboField({ value, onChange, placeholder = 'e.g. per bag', disabled = false }) {
    const isPreset = UNIT_PRESETS.some(p => p.value === value)
    const [mode, setMode] = useState(value && !isPreset ? 'custom' : 'preset')
    const [customVal, setCustomVal] = useState(!isPreset ? (value || '') : '')
    const inputRef = useRef()

    // Sync mode when value changes externally (e.g. editing an existing resource)
    useEffect(() => {
        const preset = UNIT_PRESETS.some(p => p.value === value)
        if (preset) {
            setMode('preset')
        } else if (value) {
            setMode('custom')
            setCustomVal(value)
        }
    }, [value])

    function handleSelectChange(e) {
        const selected = e.target.value
        if (selected === CUSTOM_VALUE) {
            setMode('custom')
            setCustomVal('')
            onChange('', 'per_use')
            setTimeout(() => inputRef.current?.focus(), 50)
        } else {
            setMode('preset')
            const preset = UNIT_PRESETS.find(p => p.value === selected)
            onChange(selected, preset?.billing_type || 'per_use')
        }
    }

    function handleCustomChange(e) {
        const val = e.target.value
        setCustomVal(val)
        onChange(val, 'per_use')
    }

    function handleCustomBlur() {
        if (!customVal.trim()) {
            // Revert to preset mode if left empty
            setMode('preset')
            onChange('', 'per_use')
        }
    }

    if (mode === 'custom') {
        return (
            <div className="ucf-custom-wrap">
                <input
                    ref={inputRef}
                    className="ucf-custom-input"
                    value={customVal}
                    onChange={handleCustomChange}
                    onBlur={handleCustomBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                />
                <button
                    type="button"
                    className="ucf-switch-btn"
                    onClick={() => { setMode('preset'); onChange('', 'per_use') }}
                    title="Switch to preset"
                >
                    <ChevronDown size={13} strokeWidth={1.5} />
                </button>
            </div>
        )
    }

    return (
        <select
            className="ucf-select"
            value={value && isPreset ? value : ''}
            onChange={handleSelectChange}
            disabled={disabled}
        >
            <option value="" disabled>— Select unit —</option>
            {UNIT_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
            ))}
            <option value={CUSTOM_VALUE}>Custom…</option>
        </select>
    )
}