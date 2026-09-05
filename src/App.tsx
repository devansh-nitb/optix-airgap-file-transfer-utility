import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import Header from './components/Header';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Send from './pages/Send';
import Receive from './pages/Receive';
import './index.css';

function App() {
    return (
        <ThemeProvider>
            <Router>
                <div className="app-container">
                    <Header />
                    <main className="main-content">
                        <Routes>
                            <Route path="/" element={<Landing />} />
                            <Route path="/send" element={<Send />} />
                            <Route path="/receive" element={<Receive />} />
                        </Routes>
                    </main>
                    <Footer />
                </div>
            </Router>
        </ThemeProvider>
    );
}

export default App;
