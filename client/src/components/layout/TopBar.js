import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  useTheme
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import SidebarContext from '../../context/SidebarContext';

function TopBar() {
  const location = useLocation();
  const { toggleSidebar } = useContext(SidebarContext);
  const theme = useTheme();
  
  // Get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Inicio';
      case '/quick-cost':
        return 'Costo rápido';
      case '/quotes':
        return 'Cotizaciones';
      case '/quotes/merge':
        return 'Unir cotizaciones';
      case '/sales':
        return 'Ventas';
      case '/analytics':
        return 'Análisis';
      case '/filaments':
        return 'Filamentos';
      case '/printers':
        return 'Impresoras';
      case '/hardware':
        return 'Hardware';
      case '/settings':
        return 'Configuración';
      case '/quote/new':
        return 'Nueva cotización';
      default:
        if (location.pathname.endsWith('/document') && location.pathname.startsWith('/quote/')) {
          return 'Documento PDF';
        }
        if (location.pathname.startsWith('/quote/edit/')) {
          return 'Editar cotización';
        }
        if (location.pathname.startsWith('/quote/')) {
          return 'Cotización';
        }
        return 'Impremática';
    }
  };

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{ 
        backgroundColor: 'background.paper',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        zIndex: theme.zIndex.drawer + 1 // Ensure AppBar is above drawer
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="toggle sidebar"
          edge="start"
          onClick={toggleSidebar}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" component="div" noWrap>
            {getPageTitle()}
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default TopBar;
