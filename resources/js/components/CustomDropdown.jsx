import * as React from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { KeyboardArrowDownOutlined } from '@mui/icons-material';

export default function CustomDropdown({
  buttonComponent,
  menuItems = [],
  children,
  className = '',
}) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const renderButton = buttonComponent || (
    <Button
      id="basic-button"
      aria-controls={open ? 'basic-menu' : undefined}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
      onClick={handleClick}
    >
      Dashboard
    </Button>
  );

  return (
    <div>
      {React.cloneElement(renderButton, { onClick: handleClick })}

      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'basic-button',
        }}
        disablePortal={true}
        className={className}
      >
        <div className={`px-2 font-jakarta`}>
            {children}
        </div>
        {children ? <hr className='my-2' /> : ''}
        {menuItems.map((item, index) => item?.render && (
          <MenuItem className={`font-jakarta`} key={index} onClick={() => {
            handleClose();
            item.onClick?.();
          }}>
            <div className={`flex items-center ${item.className}`}>
              {item.icon && (
                <span className="mr-2">
                  {item.icon}
                </span>
              )}
              <div>
                <p className={`font-jakarta text-sm`}>
                  {item.label}
                </p>
                {item.sublabel && (
                  <p className={`font-jakarta text-xs font-light`}>
                    {item.sublabel}
                  </p>
                )}
              </div>
            </div>
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

export const CustomDropdown2 = ({
  children,
  title = 'Ini adalah Dropdown',
  titleContainer,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={`border rounded-md border-zinc-300 relative overflow-hidden`}>
      <button onClick={() => setOpen(state => !state)} type='button' className={`flex cursor-pointer items-center justify-between ${open ? 'bg-zinc-100 hover:bg-zinc-200' : 'bg-white hover:bg-zinc-100'} ease-out duration-100 w-full p-4`}>
        {titleContainer
          ? titleContainer
          : (
            <h1 className='font-jakarta'>
              {title}
            </h1>
          )
        }
        <KeyboardArrowDownOutlined fontSize="small" className={`${open ? 'rotate-180' : ''} ease-out duration-100`} />
      </button>
      {open && (
        <div className="p-4 bg-white border-t border-zinc-300">
          {children
            ? children
            : (
              <div>
                Ini adalah Children
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}
