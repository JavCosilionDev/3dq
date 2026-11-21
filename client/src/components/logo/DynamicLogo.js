import React from 'react';

function DynamicLogo({ height = '40px' }) {
  return (
    <img
      src="/logo-imprematica.png"
      alt="Impremática"
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}

export default DynamicLogo;
