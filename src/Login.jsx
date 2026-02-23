import { useState } from 'react';
import { Logo } from './Logo';
import { Lock, Mail, AlertCircle, Loader } from 'lucide-react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from './firebase';
import './Login.css';

export function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(false);
        setIsLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Temporary role logic until Firestore roles are fully synced
            const role = email.includes('admin') ? 'admin' : 'operator';

            onLogin({
                name: user.email.split('@')[0], // Use part of email as name for now
                role: role,
                uid: user.uid
            });

        } catch (error) {
            console.error("Firebase Login Error:", error);
            setError(true);
            setErrorMessage(
                error.code === 'auth/invalid-credential'
                    ? 'Correo o contraseña incorrectos.'
                    : 'Error al iniciar sesión. Verifica tu conexión.'
            );
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <Logo />
                    <h2>Movimientos de Caja</h2>
                    <p>Inicia sesión para acceder al sistema</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && (
                        <div className="login-error">
                            <AlertCircle size={18} style={{ flexShrink: 0 }} />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    <div className="form-group login-input-group">
                        <Mail size={18} className="input-icon" />
                        <input
                            type="email"
                            placeholder="Correo electrónico"
                            className="form-control"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group login-input-group">
                        <Lock size={18} className="input-icon" />
                        <input
                            type="password"
                            placeholder="Contraseña"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-submit login-btn" disabled={isLoading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        {isLoading ? <Loader size={18} className="spinner" /> : 'Ingresar al Sistema'}
                    </button>
                </form>

                <div className="login-footer">
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Acceso restringido a personal autorizado.</p>
                </div>
            </div>
        </div>
    );
}
