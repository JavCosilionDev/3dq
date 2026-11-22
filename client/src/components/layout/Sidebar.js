import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import DynamicLogo from '../logo/DynamicLogo';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,

  useTheme,
  useMediaQuery
} from '@mui/material';

import {
  Description as DescriptionIcon,
  Palette as PaletteIcon,
  Print as PrintIcon,
  Hardware as HardwareIcon,
  Settings as SettingsIcon,
  FlashOn as FlashOnIcon,
  Home as HomeIcon,
  PointOfSale as PointOfSaleIcon,
  Insights as InsightsIcon
} from '@mui/icons-material';
import SettingsContext from '../../context/SettingsContext';
import SidebarContext from '../../context/SidebarContext';

// Sidebar width
const drawerWidth = 240;

function Sidebar() {
  const location = useLocation();
  const { settings } = useContext(SettingsContext);
  const { open, toggleSidebar } = useContext(SidebarContext);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Define sidebar menu items
  const menuItems = [
    {
      text: 'Inicio',
      icon: <HomeIcon />,
      path: '/'
    },
    {
      text: 'Costo rápido',
      icon: <FlashOnIcon />,
      path: '/quick-cost'
    },
    {
      text: 'Cotizaciones',
      icon: <DescriptionIcon />,
      path: '/quotes'
    },
    {
      text: 'Ventas',
      icon: <PointOfSaleIcon />,
      path: '/sales'
    },
    {
      text: 'Análisis',
      icon: <InsightsIcon />,
      path: '/analytics'
    },
    {
      text: 'Filamentos',
      icon: <PaletteIcon />,
      path: '/filaments'
    },
    {
      text: 'Impresoras',
      icon: <PrintIcon />,
      path: '/printers'
    },
    {
      text: 'Hardware',
      icon: <HardwareIcon />,
      path: '/hardware'
    },
    {
      text: 'Configuración',
      icon: <SettingsIcon />,
      path: '/settings'
    }
  ];

  return (
    <Drawer
      variant={isSmallScreen ? "temporary" : "persistent"}
      open={open}
      onClose={toggleSidebar}
      sx={{
        width: open ? drawerWidth : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider'
        },
      }}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
    >
      <Box sx={{ overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DynamicLogo height="40px" />
        </Box>
        <Divider />
        <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: alpha(settings.accent_color || '#0060FA', 0.2),
                  '&:hover': {
                    backgroundColor: alpha(settings.accent_color || '#0060FA', 0.3),
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === item.path ? settings.accent_color || '#0060FA' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
        </List>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
