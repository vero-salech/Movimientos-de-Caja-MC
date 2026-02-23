import { useState, useEffect, useMemo } from 'react';
import {
  Activity, DollarSign, TrendingUp, TrendingDown,
  PlusCircle, ArrowUpRight, ArrowDownRight, Trash2, Wallet,
  BarChart3, LayoutDashboard, LogOut, Download
} from 'lucide-react';
import { CATEGORY_DATA } from './dataConfig';
import { generateSeedRecords } from './seedData';
import { Logo } from './Logo';
import { Login } from './Login';
import { db } from './firebase';
import { collection, addDoc, deleteDoc, onSnapshot, doc, query, orderBy, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import './App.css';

function App() {
  const [user, setUser] = useState(null); // Auth State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const [records, setRecords] = useState([]);
  const [isInitializingData, setIsInitializingData] = useState(true);

  const defaultType = 'Egreso';
  const defaultCat = Object.keys(CATEGORY_DATA[defaultType])[0];
  const defaultSub = CATEGORY_DATA[defaultType][defaultCat][0] || '';

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: defaultType,
    category: defaultCat,
    subcategory: defaultSub,
    concept: '',
    amount: ''
  });

  // Firebase Realtime Listener & LocalStorage Migration
  useEffect(() => {
    if (!user) return; // Only sync when logged in

    const q = query(collection(db, "records"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let recordsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      if (snapshot.empty && isInitializingData) {
        setIsInitializingData(false);
        const local = localStorage.getItem('finanzasRecords');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (parsed.length > 0) {
              const batch = writeBatch(db);
              parsed.forEach(r => {
                const docRef = doc(collection(db, "records"));
                const { id, ...dataToSave } = r; // Strip old local id
                batch.set(docRef, dataToSave);
              });
              await batch.commit();
              console.log("Migración a la nube exitosa!");
              localStorage.removeItem('finanzasRecords');
            }
          } catch (e) { console.error("Error migrating:", e); }
        } else {
          // If completely empty, push seed data
          const seeds = generateSeedRecords(CATEGORY_DATA);
          const batch = writeBatch(db);
          seeds.forEach(r => {
            const docRef = doc(collection(db, "records"));
            const { id, ...dataToSave } = r;
            batch.set(docRef, dataToSave);
          });
          await batch.commit();
          console.log("Datos de prueba en la nube insertados.");
        }
        return; // wait for next snapshot triggered by batch commit
      }

      recordsData.sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff === 0 && a.createdAt && b.createdAt) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return dateDiff;
      });
      setRecords(recordsData);
      setIsInitializingData(false);
    }, (error) => {
      console.error("Error listening to Firestore:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // General Status Calculation
  const stats = records.reduce((acc, req) => {
    const amount = Number(req.amount);
    if (req.type === 'Ingreso') {
      acc.income += amount;
      acc.balance += amount;
    } else {
      acc.expense += amount;
      acc.balance -= amount;
    }
    return acc;
  }, { balance: 0, income: 0, expense: 0 });

  const formatCurrency = (val) => {
    if (val === 0) return '$ 0';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  // Form Handlers
  const currentCategories = Object.keys(CATEGORY_DATA[formData.type] || {});
  const currentSubCategories = CATEGORY_DATA[formData.type]?.[formData.category] || [];

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    const newCats = Object.keys(CATEGORY_DATA[newType]);
    const firstCat = newCats[0] || '';
    const firstSub = CATEGORY_DATA[newType][firstCat]?.[0] || '';

    setFormData(prev => ({
      ...prev,
      type: newType,
      category: firstCat,
      subcategory: firstSub
    }));
  };

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    const firstSub = CATEGORY_DATA[formData.type][newCat]?.[0] || '';

    setFormData(prev => ({
      ...prev,
      category: newCat,
      subcategory: firstSub
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category) return;

    try {
      await addDoc(collection(db, "records"), {
        ...formData,
        amount: Number(formData.amount),
        createdAt: new Date().toISOString()
      });

      setFormData(prev => ({
        ...prev,
        concept: '',
        amount: ''
      }));
    } catch (err) {
      console.error(err);
      alert("Error al guardar en la nube: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este registro oficil de la base de datos?")) {
      try {
        await deleteDoc(doc(db, "records", id));
      } catch (err) {
        console.error(err);
        alert("Error al eliminar: " + err.message);
      }
    }
  };


  // Pivot Table Calculation
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const displayMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const pivotData = useMemo(() => {
    const matrix = { Egreso: {}, Ingreso: {} };

    // Initialize matrix
    Object.keys(CATEGORY_DATA.Egreso).forEach(cat => {
      matrix.Egreso[cat] = months.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
    });
    Object.keys(CATEGORY_DATA.Ingreso).forEach(cat => {
      matrix.Ingreso[cat] = months.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
    });

    const subtotals = {
      Egreso: months.reduce((acc, m) => ({ ...acc, [m]: 0 }), {}),
      Ingreso: months.reduce((acc, m) => ({ ...acc, [m]: 0 }), {})
    };

    records.filter(r => r.date.startsWith(selectedYear)).forEach(r => {
      const monthGroup = r.date.substring(5, 7);
      const amt = Number(r.amount);
      if (matrix[r.type] && matrix[r.type][r.category] && subtotals[r.type][monthGroup] !== undefined) {
        matrix[r.type][r.category][monthGroup] += amt;
        subtotals[r.type][monthGroup] += amt;
      }
    });

    return { matrix, subtotals };
  }, [records, selectedYear]);

  // Unique years for the filter
  const availableYears = useMemo(() => {
    const years = new Set(records.map(r => r.date.substring(0, 4)));
    years.add(new Date().getFullYear().toString());
    years.add('2025'); // Add explicitly as requested
    return Array.from(years).sort().reverse(); // Always show newest first
  }, [records]);

  // Excel Export Logic
  const exportToExcelDashboard = () => {
    let filteredRecords = records;
    if (exportStartDate) {
      filteredRecords = filteredRecords.filter(r => r.date >= exportStartDate);
    }
    if (exportEndDate) {
      filteredRecords = filteredRecords.filter(r => r.date <= exportEndDate);
    }

    if (filteredRecords.length === 0) {
      alert("No se encontraron movimientos registrados en ese rango de fechas exacto.");
      return;
    }

    // Sort oldest to newest for chronological export
    filteredRecords = [...filteredRecords].sort((a, b) => new Date(a.date) - new Date(b.date));

    const data = filteredRecords.map(r => ({
      Fecha: r.date, Tipo: r.type,
      Categoría: r.category, Subcategoría: r.subcategory,
      Concepto: r.concept, Monto: r.amount
    }));

    // Force specific column order manually overriding object keys
    const ws = XLSX.utils.json_to_sheet(data, { header: ["Fecha", "Tipo", "Categoría", "Subcategoría", "Concepto", "Monto"] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
    XLSX.writeFile(wb, `caja_movimientos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToExcelAnnual = () => {
    const exportData = [];
    ['Egreso', 'Ingreso'].forEach(tipo => {
      Object.keys(CATEGORY_DATA[tipo]).forEach(cat => {
        const row = { Tipo: tipo, Categoría: cat };
        let total = 0;
        months.forEach(m => {
          const val = pivotData.matrix[tipo][cat]?.[m] || 0;
          row[m] = val;
          total += val;
        });
        row['Total'] = total;
        exportData.push(row);
      });
      // Add subtotal row
      const subRow = { Tipo: tipo, Categoría: `TOTAL ${tipo.toUpperCase()}` };
      months.forEach(m => { subRow[m] = pivotData.subtotals[tipo][m]; });
      subRow['Total'] = months.reduce((a, m) => a + pivotData.subtotals[tipo][m], 0);
      exportData.push(subRow);
      exportData.push({}); // Space
    });

    // Add DIFERENCIA
    const difRow = { Tipo: 'BALANCE', Categoría: 'DIFERENCIA' };
    months.forEach(m => {
      difRow[m] = pivotData.subtotals.Ingreso[m] - pivotData.subtotals.Egreso[m];
    });
    difRow['Total'] = months.reduce((a, m) => a + (pivotData.subtotals.Ingreso[m] - pivotData.subtotals.Egreso[m]), 0);
    exportData.push(difRow);

    const headers = ["Tipo", "Categoría", ...months, "Total"];
    const ws = XLSX.utils.json_to_sheet(exportData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Resumen_${selectedYear}`);
    XLSX.writeFile(wb, `resumen_anual_${selectedYear}.xlsx`);
  };
  // Security layer: If an operator logs in, force them back to dashboard immediately
  useEffect(() => {
    if (user && user.role !== 'admin' && activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
  }, [user, activeTab]);

  // Auth Render Gate
  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  const isAdmin = user.role === 'admin';
  return (
    <div className="app-container">
      <header className="header" style={{ alignItems: 'flex-start' }}>
        <div className="brand" style={{ marginBottom: '1rem' }}>
          <Logo />
          <span>Movimientos de Caja</span>
        </div>

        <div className="user-info-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Conectado como: <span style={{ color: 'var(--text-primary)' }}>{user.name}</span>
            {!isAdmin && <span style={{ marginLeft: '6px', background: '#d1fae5', color: '#047857', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>Operador</span>}
          </div>
          <button
            onClick={() => { setUser(null); setActiveTab('dashboard'); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', color: 'var(--danger)', fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Tabs Navigation (Hidden for operators) */}
      {isAdmin && (
        <nav className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} /> Dashboard & Cargas
          </button>
          <button
            className={`tab-btn ${activeTab === 'resumen' ? 'active' : ''}`}
            onClick={() => setActiveTab('resumen')}
          >
            <BarChart3 size={18} /> Resumen Anual
          </button>
        </nav>
      )}

      {/* Primary View: Dashboard (Always shown for operator, toggled for admin) */}
      {(activeTab === 'dashboard' || !isAdmin) && (
        <>
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Saldo Total</div>
              <div className={`stat-value ${stats.balance >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(stats.balance)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                Ingresos <TrendingUp size={16} color="var(--success)" />
              </div>
              <div className="stat-value positive">{formatCurrency(stats.income)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                Egresos <TrendingDown size={16} color="var(--danger)" />
              </div>
              <div className="stat-value negative">{formatCurrency(stats.expense)}</div>
            </div>
          </section>

          <main className="main-content">
            {/* Form Column */}
            <section className="glass-card">
              <div className="card-header">
                <div className="card-title-group">
                  <PlusCircle size={24} color="var(--accent-blue)" />
                  <span className="card-title">Nuevo Movimiento</span>
                </div>
              </div>

              <form className="finance-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Fecha</label>
                    <input
                      type="date"
                      name="date"
                      className="form-control"
                      value={formData.date}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo</label>
                    <select
                      name="type"
                      className="form-control"
                      value={formData.type}
                      onChange={handleTypeChange}
                    >
                      <option value="Egreso">Egreso</option>
                      <option value="Ingreso">Ingreso</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <select
                      name="category"
                      className="form-control"
                      value={formData.category}
                      onChange={handleCategoryChange}
                      required
                    >
                      {currentCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">SubCategoría</label>
                    <select
                      name="subcategory"
                      className="form-control"
                      value={formData.subcategory}
                      onChange={handleInputChange}
                      disabled={currentSubCategories.length === 0}
                    >
                      {currentSubCategories.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                      {currentSubCategories.length === 0 && <option value="">Sin Subcategoría</option>}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Concepto (Opcional)</label>
                  <input
                    type="text"
                    name="concept"
                    placeholder="Detalle extra del movimiento"
                    className="form-control"
                    value={formData.concept}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Importe ($)</label>
                  <input
                    type="number"
                    name="amount"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="form-control"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <button type="submit" className="btn-submit">
                  Guardar Movimiento
                </button>
              </form>
            </section>

            {/* List Column */}
            <section className="glass-card">
              <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="card-title-group" style={{ minWidth: 'min-content' }}>
                  <Activity size={24} color="var(--accent-purple)" />
                  <span className="card-title" style={{ whiteSpace: 'nowrap' }}>Últimos Movimientos</span>
                </div>
                {isAdmin && (
                  <div className="hide-mobile" style={{ display: 'none' }} />
                )}
                {isAdmin && (
                  <div className="desktop-filters hide-mobile" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input
                        type="date"
                        className="form-control"
                        style={{ padding: '0.3rem', fontSize: '0.75rem', width: 'auto' }}
                        value={exportStartDate}
                        onChange={e => setExportStartDate(e.target.value)}
                        title="Fecha desde"
                      />
                      <span style={{ color: '#9ca3af' }}>-</span>
                      <input
                        type="date"
                        className="form-control"
                        style={{ padding: '0.3rem', fontSize: '0.75rem', width: 'auto' }}
                        value={exportEndDate}
                        onChange={e => setExportEndDate(e.target.value)}
                        title="Fecha hasta"
                      />
                    </div>
                    <button onClick={exportToExcelDashboard} className="btn-submit" style={{ margin: 0, padding: '0.3rem 0.6rem', fontSize: '0.75rem', height: '100%', display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#64748b' }} title="Descargar datos en Excel">
                      <Download size={12} /> Exportar Excel
                    </button>
                  </div>
                )}
              </div>

              <div className="records-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {records.length === 0 ? (
                  <div className="empty-state">
                    <DollarSign size={48} opacity={0.5} style={{ margin: '0 auto 1rem' }} />
                    <p>Aún no hay registros cargados.</p>
                  </div>
                ) : (
                  records.slice(0, 50).map(record => (
                    <div className="record-item" key={record.id}>
                      <div className={`record-icon ${record.type.toLowerCase()}`}>
                        {record.type === 'Ingreso' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                      </div>

                      <div className="record-details">
                        <span className="record-title">{record.category}</span>
                        <span className="record-meta">
                          {new Date(record.date).toLocaleDateString('es-AR')} • {record.subcategory} {record.concept && `(${record.concept})`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className={`record-amount ${record.type.toLowerCase()}`}>
                          {record.type === 'Ingreso' ? '+' : '-'}{formatCurrency(record.amount)}
                        </span>

                        {isAdmin && (
                          <button className="delete-btn" onClick={() => handleDelete(record.id)} title="Eliminar registro">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </main>
        </>
      )}

      {isAdmin && activeTab === 'resumen' && (
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <div className="stats-grid-small" style={{ marginBottom: '2rem' }}>
              <div className="stat-card-small" style={{ borderLeft: '3px solid var(--success)' }}>
                <div className="stat-label">
                  Ingresos Totales ({selectedYear})
                </div>
                <div className="stat-value positive" style={{ fontSize: '1.1rem' }}>
                  {formatCurrency(months.reduce((a, m) => a + pivotData.subtotals.Ingreso[m], 0))}
                </div>
              </div>
              <div className="stat-card-small" style={{ borderLeft: '3px solid var(--danger)' }}>
                <div className="stat-label">
                  Egresos Totales ({selectedYear})
                </div>
                <div className="stat-value negative" style={{ fontSize: '1.1rem' }}>
                  {formatCurrency(months.reduce((a, m) => a + pivotData.subtotals.Egreso[m], 0))}
                </div>
              </div>
            </div>
          </div>

          <div className="card-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title-group">
              <BarChart3 size={24} color="var(--accent-purple)" />
              <span className="card-title">Resumen General por Año ({selectedYear})</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select
                className="form-control"
                style={{ width: 'auto', padding: '0.5rem' }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>Año {yr}</option>
                ))}
              </select>
              <button onClick={exportToExcelAnnual} className="btn-submit hide-mobile" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981' }} title="Descargar matriz en Excel">
                <Download size={14} /> Descargar Matriz
              </button>
            </div>
          </div>

          <div className="pivot-table-container">
            <table className="pivot-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Categoría</th>
                  {displayMonths.map(m => (
                    <th key={m}>{m} {selectedYear}</th>
                  ))}
                  <th>Total Año</th>
                </tr>
              </thead>
              <tbody>
                {/* EGRESOS */}
                {Object.keys(CATEGORY_DATA.Egreso).map(cat => {
                  const totalRow = months.reduce((acc, m) => acc + pivotData.matrix.Egreso[cat][m], 0);
                  return (
                    <tr key={cat}>
                      <td className="row-header">{cat}</td>
                      {months.map(m => {
                        const val = pivotData.matrix.Egreso[cat][m];
                        return <td key={m} className={val === 0 ? 'val-zero' : ''}>{formatCurrency(val)}</td>
                      })}
                      <td className={totalRow === 0 ? 'val-zero' : ''}>{formatCurrency(totalRow)}</td>
                    </tr>
                  );
                })}
                <tr className="subtotal-row egresos">
                  <td className="row-header">Total Egresos</td>
                  {months.map(m => (
                    <td key={m}>{formatCurrency(pivotData.subtotals.Egreso[m])}</td>
                  ))}
                  <td>{formatCurrency(months.reduce((a, m) => a + pivotData.subtotals.Egreso[m], 0))}</td>
                </tr>

                {/* SPACING */}
                <tr><td colSpan={14} style={{ border: 'none', height: '1.5rem', background: 'transparent' }}></td></tr>

                {/* INGRESOS */}
                {Object.keys(CATEGORY_DATA.Ingreso).map(cat => {
                  const totalRow = months.reduce((acc, m) => acc + pivotData.matrix.Ingreso[cat][m], 0);
                  return (
                    <tr key={cat}>
                      <td className="row-header">{cat}</td>
                      {months.map(m => {
                        const val = pivotData.matrix.Ingreso[cat][m];
                        return <td key={m} className={val === 0 ? 'val-zero' : ''}>{formatCurrency(val)}</td>
                      })}
                      <td className={totalRow === 0 ? 'val-zero' : ''}>{formatCurrency(totalRow)}</td>
                    </tr>
                  );
                })}
                <tr className="subtotal-row ingresos">
                  <td className="row-header">Total Ingresos</td>
                  {months.map(m => (
                    <td key={m}>{formatCurrency(pivotData.subtotals.Ingreso[m])}</td>
                  ))}
                  <td>{formatCurrency(months.reduce((a, m) => a + pivotData.subtotals.Ingreso[m], 0))}</td>
                </tr>

                {/* SPACING */}
                <tr><td colSpan={14} style={{ border: 'none', height: '1.5rem', background: 'transparent' }}></td></tr>

                {/* DIFERENCIA */}
                <tr className="diferencia-row">
                  <td className="row-header" style={{ background: '#e2e8f0' }}>DIFERENCIA</td>
                  {months.map(m => {
                    const dif = pivotData.subtotals.Ingreso[m] - pivotData.subtotals.Egreso[m];
                    return (
                      <td key={m} className={dif > 0 ? 'val-positive' : (dif < 0 ? 'val-negative' : 'val-zero')}>
                        {formatCurrency(dif)}
                      </td>
                    );
                  })}
                  <td style={{ fontWeight: 800 }}>
                    {(() => {
                      const totalIng = months.reduce((a, m) => a + pivotData.subtotals.Ingreso[m], 0);
                      const totalEgr = months.reduce((a, m) => a + pivotData.subtotals.Egreso[m], 0);
                      const finalDif = totalIng - totalEgr;
                      return (
                        <span className={finalDif > 0 ? 'val-positive' : (finalDif < 0 ? 'val-negative' : 'val-zero')}>
                          {formatCurrency(finalDif)}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}

export default App;
