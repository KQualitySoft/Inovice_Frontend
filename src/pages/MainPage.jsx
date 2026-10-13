import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function MainPage() {

  return (
    <div className="page-wrapper">
      <div className="main-card">
        {/* Navigation Bar */}
        <header className="navbar">
          <div className="logo">
            <img src={logo} alt="KQualitySoft Logo" />
          </div>


        </header>

        <main className="hero-container">
          <div className="hero-left">
            <h1 className="hero-title">Quality SalesPro</h1>
            <p className="hero-subtitle">Smart Sales...Faster Growth...</p>

            <div className="cta-buttons">
              <Link to="/login" className="btn btn-outline button">
                Login
              </Link>
            </div>
          </div>

          <div className="hero-right">
            <div className="laptop-mockup">
              <div className="laptop-screen">
                <div className="screen-header">
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
                <div className="dashboard-preview">
                  <div className="dash-top">
                    <div className="dash-stat">
                      Invoices
                      <br />
                      <strong>3,920</strong>
                    </div>
                    <div className="dash-stat text-right">
                      Revenue
                      <br />
                      <strong>$90K</strong>
                    </div>
                  </div>
                  <div className="dash-body">
                    <div className="dash-rows">
                      <div className="dash-row">
                        <span>✓ Invoice #1270</span>
                        <strong>$25,000</strong>
                      </div>
                      <div className="dash-row">
                        <span>✓ Invoice #1269</span>
                        <strong>$9,576</strong>
                      </div>
                      <div className="dash-row">
                        <span>✓ Invoice #1268</span>
                        <strong>$775</strong>
                      </div>
                    </div>
                    <div className="dash-chart">
                      <div className="chart-bars">
                        <div className="bar" style={{ height: '40%' }}></div>
                        <div className="bar" style={{ height: '60%' }}></div>
                        <div className="bar" style={{ height: '90%' }}></div>
                        <div className="bar" style={{ height: '50%' }}></div>
                        <div className="bar" style={{ height: '75%' }}></div>
                      </div>
                      <div className="chart-line"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="laptop-base"></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
